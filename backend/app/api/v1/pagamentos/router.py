"""Router de Pagamentos — checkout (Mercado Pago) e webhook.

Trava de segurança: a criação de cobrança real exige `settings.PAGAMENTOS_GO_LIVE`
(Fly secret) ligada. Sem isso, `/checkout` responde 503 — o código fica pronto,
mas NÃO cobra ninguém até o go-live explícito.
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual, require_role
from app.core.config import settings
from app.core.database import get_session
from app.core.pagamentos import (
    GatewayNaoConfiguradoError,
    GatewayPagamentoError,
    gateway,
    validar_assinatura_webhook,
)
from app.core.pci import motivo_dados_cartao, redigir_sensivel
from app.core.planos import get_plano
from app.models.saas import Assinatura, PagamentoEvento
from app.models.usuario import TipoUsuario, Usuario
from app.services.assinatura import get_assinatura
from app.services.assinatura import resumo as resumo_assinatura
from app.services.audit import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])

CICLOS_VALIDOS = {"mensal", "trimestral", "semestral", "anual"}


class CheckoutRequest(BaseModel):
    plano_slug: str
    ciclo: str = "mensal"
    email: str | None = None


class CheckoutResponse(BaseModel):
    tipo: str
    id: str | None
    init_point: str | None


class PagamentoConfigResponse(BaseModel):
    gateway: str = "mercadopago"
    public_key: str
    go_live: bool


@router.get("/config", response_model=PagamentoConfigResponse)
async def config_pagamento(usuario: Usuario = Depends(get_usuario_atual)):
    """Dados públicos do gateway para o frontend (public key é seguro expor)."""
    return PagamentoConfigResponse(
        public_key=settings.MERCADO_PAGO_PUBLIC_KEY,
        go_live=settings.PAGAMENTOS_GO_LIVE,
    )


@router.post("/checkout", response_model=CheckoutResponse, status_code=201)
async def criar_checkout(
    dados: CheckoutRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Cria a cobrança (assinatura mensal ou cobrança única por ciclo).

    503 enquanto `PAGAMENTOS_GO_LIVE` estiver desligado (cobrança não habilitada).
    """
    # P0-05 — o SessãoInk usa Checkout Pro: nenhum dado de cartão deve chegar aqui.
    # Rejeita ANTES do gate de go-live (sempre 400, mesmo com cobrança desligada).
    try:
        raw_body = await request.json()
    except Exception:
        raw_body = {}
    motivo = motivo_dados_cartao(raw_body)
    if motivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dados de cartão não são aceitos neste endpoint ({motivo}).",
        )

    if not settings.PAGAMENTOS_GO_LIVE:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pagamentos em configuração — cobrança ainda não habilitada.",
        )
    if dados.ciclo not in CICLOS_VALIDOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Ciclo inválido: {dados.ciclo}")
    if not get_plano(dados.plano_slug):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Plano inexistente: {dados.plano_slug}")

    email = dados.email or usuario.email
    referencia = str(usuario.estudio_id)

    try:
        if dados.ciclo == "mensal":
            resultado = await gateway.criar_assinatura(
                plano_slug=dados.plano_slug, email_pagador=email, referencia=referencia
            )
        else:
            resultado = await gateway.criar_cobranca_unica(
                plano_slug=dados.plano_slug,
                ciclo=dados.ciclo,
                email_pagador=email,
                referencia=referencia,
            )
    except GatewayNaoConfiguradoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except GatewayPagamentoError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    # Vincula a intenção de assinatura ao estúdio (ATIVA de fato só no webhook
    # quando o pagamento for aprovado).
    assinatura = await get_assinatura(session, usuario.estudio_id)
    if assinatura is not None:
        assinatura.plano_slug = dados.plano_slug
        assinatura.ciclo = dados.ciclo
        assinatura.gateway = "mercadopago"
        if resultado.get("id"):
            assinatura.externo_id = str(resultado.get("id"))
        await session.flush()

    await log_event(
        session,
        acao="pagamento.checkout.criado",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="pagamento",
        entidade_id=str(resultado.get("id")),
        dados={"plano": dados.plano_slug, "ciclo": dados.ciclo, "tipo": resultado.get("tipo")},
        commit=True,
    )
    return CheckoutResponse(**resultado)


@router.get("/assinatura")
async def status_assinatura(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Status da assinatura do estúdio (plano, trial, dias restantes) para o frontend."""
    assinatura = await get_assinatura(session, usuario.estudio_id)
    return resumo_assinatura(assinatura)


@router.post("/webhook", status_code=200)
async def webhook_mercadopago(
    request: Request,
    session: AsyncSession = Depends(get_session),
    x_signature: str | None = Header(default=None),
    x_request_id: str | None = Header(default=None),
):
    """Recebe notificações do Mercado Pago. Idempotente (inbox dedup).

    Valida a assinatura HMAC (se o webhook secret estiver configurado). Sempre
    responde 200 rápido para o gateway não reenfileirar — o processamento pesado
    é best-effort.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    tipo = body.get("type") or body.get("topic") or "desconhecido"
    data = body.get("data") or {}
    recurso_id = str(data.get("id") or body.get("id") or request.query_params.get("data.id") or "")

    if not validar_assinatura_webhook(
        x_signature=x_signature,
        x_request_id=x_request_id,
        data_id=recurso_id,
        max_idade_segundos=600,  # P0-07 — janela anti-replay de 10 min
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Assinatura inválida."
        )

    if not recurso_id:
        return {"status": "ignorado"}

    # Idempotência: insere no inbox; se já existir (dedup), não reprocessa.
    # P0-05 — redige segredos/dados de cartão antes de persistir o payload.
    evento = PagamentoEvento(
        gateway="mercadopago",
        evento_tipo=str(tipo),
        recurso_id=recurso_id,
        dados=redigir_sensivel(body),
    )
    session.add(evento)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return {"status": "duplicado"}

    # Reconciliação best-effort (só com token; em testes/sem token, apenas registra).
    if tipo == "payment" and gateway.configurado():
        try:
            pagamento = await gateway.obter_pagamento(recurso_id)
            evento.status = pagamento.get("status")
            referencia = pagamento.get("external_reference")
            if referencia and pagamento.get("status") == "approved":
                assinatura = await session.scalar(
                    select(Assinatura).where(Assinatura.estudio_id == referencia)
                )
                if assinatura:
                    from app.models.saas import StatusAssinatura

                    ja_ativa = assinatura.status == StatusAssinatura.ATIVA
                    assinatura.status = StatusAssinatura.ATIVA
                    assinatura.gateway = "mercadopago"
                    evento.assinatura_id = assinatura.id
                    evento.estudio_id = assinatura.estudio_id
                    if not ja_ativa:
                        await log_event(
                            session,
                            acao="assinatura.activated",
                            estudio_id=assinatura.estudio_id,
                            entidade="assinatura",
                            entidade_id=str(assinatura.id),
                            dados={"gateway": "mercadopago", "pagamento_id": recurso_id},
                        )
            evento.processado = True
        except GatewayPagamentoError as exc:
            logger.warning("webhook_reconciliacao_falhou", extra={"extra": {"erro": str(exc)}})

    await session.commit()
    return {"status": "ok"}
