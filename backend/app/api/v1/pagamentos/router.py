"""Router de Pagamentos — checkout (Mercado Pago) e webhook.

Trava de segurança: a criação de cobrança real exige `settings.PAGAMENTOS_GO_LIVE`
(Fly secret) ligada. Sem isso, `/checkout` responde 503 — o código fica pronto,
mas NÃO cobra ninguém até o go-live explícito.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

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
    valor_venda_centavos,
)
from app.core.pci import motivo_dados_cartao, redigir_sensivel
from app.core.planos import get_plano
from app.models.saas import (
    Assinatura,
    Cobranca,
    Pagamento,
    PagamentoEvento,
    StatusAssinatura,
    StatusCobranca,
    StatusPagamento,
)
from app.models.usuario import TipoUsuario, Usuario
from app.services.assinatura import get_assinatura
from app.services.assinatura import resumo as resumo_assinatura
from app.services.audit import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pagamentos", tags=["pagamentos"])

CICLOS_VALIDOS = {"mensal", "trimestral", "semestral", "anual"}

# Mapa status do Mercado Pago → enum local de pagamento.
_MAP_STATUS_PAGAMENTO = {
    "approved": StatusPagamento.APPROVED,
    "authorized": StatusPagamento.AUTHORIZED,
    "in_process": StatusPagamento.IN_PROCESS,
    "in_mediation": StatusPagamento.IN_PROCESS,
    "pending": StatusPagamento.PENDING,
    "rejected": StatusPagamento.REJECTED,
    "refunded": StatusPagamento.REFUNDED,
    "charged_back": StatusPagamento.CHARGED_BACK,
    "cancelled": StatusPagamento.CANCELLED,
}


def _map_status_pagamento(mp_status: str | None) -> StatusPagamento:
    return _MAP_STATUS_PAGAMENTO.get((mp_status or "").lower(), StatusPagamento.PENDING)


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
    plano = get_plano(dados.plano_slug)
    if not plano:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Plano inexistente: {dados.plano_slug}")

    email = dados.email or usuario.email
    agora = datetime.now(UTC)
    tipo_checkout = "assinatura" if dados.ciclo == "mensal" else "cobranca_unica"

    # P0-06 — reuso anti duplo-clique: se já há uma cobrança pendente válida
    # (mesmo plano/ciclo) com checkout gerado, reaproveita em vez de duplicar.
    cobranca = await session.scalar(
        select(Cobranca)
        .where(
            Cobranca.estudio_id == usuario.estudio_id,
            Cobranca.plano_slug == dados.plano_slug,
            Cobranca.ciclo == dados.ciclo,
            Cobranca.status.in_(
                [StatusCobranca.CRIADA, StatusCobranca.ENVIADA_GATEWAY, StatusCobranca.PENDENTE]
            ),
            Cobranca.init_point.is_not(None),
        )
        .order_by(Cobranca.criado_em.desc())
    )
    if cobranca is not None:
        # SQLite devolve datetime naive; normaliza para UTC antes de comparar.
        expira = cobranca.expira_em
        if expira is not None and expira.tzinfo is None:
            expira = expira.replace(tzinfo=UTC)
        if expira is None or expira > agora:
            return CheckoutResponse(
                tipo=tipo_checkout,
                id=cobranca.gateway_preapproval_id or cobranca.gateway_preference_id,
                init_point=cobranca.init_point,
            )

    # P0-06 — cria a cobrança local ANTES do gateway. id pré-gerado → usado como
    # external_reference e idempotency_key (NUNCA o estudio_id: não vaza o tenant
    # e não colapsa checkouts distintos). Valor calculado no servidor.
    cob_id = uuid.uuid4()
    cobranca = Cobranca(
        id=cob_id,
        estudio_id=usuario.estudio_id,
        plano_slug=dados.plano_slug,
        ciclo=dados.ciclo,
        valor_centavos=valor_venda_centavos(plano, dados.ciclo, email=email),
        status=StatusCobranca.CRIADA,
        external_reference=str(cob_id),
        idempotency_key=str(cob_id),
        expira_em=agora + timedelta(hours=24),
        created_by_usuario_id=usuario.id,
    )
    session.add(cobranca)
    await session.flush()

    try:
        if dados.ciclo == "mensal":
            resultado = await gateway.criar_assinatura(
                plano_slug=dados.plano_slug, email_pagador=email, referencia=str(cob_id)
            )
            cobranca.gateway_preapproval_id = (
                str(resultado["id"]) if resultado.get("id") else None
            )
        else:
            resultado = await gateway.criar_cobranca_unica(
                plano_slug=dados.plano_slug,
                ciclo=dados.ciclo,
                email_pagador=email,
                referencia=str(cob_id),
            )
            cobranca.gateway_preference_id = (
                str(resultado["id"]) if resultado.get("id") else None
            )
    except GatewayNaoConfiguradoError as exc:
        cobranca.status = StatusCobranca.FALHA
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except GatewayPagamentoError as exc:
        cobranca.status = StatusCobranca.FALHA
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    cobranca.init_point = resultado.get("init_point")
    cobranca.status = StatusCobranca.ENVIADA_GATEWAY

    # Vincula a intenção de assinatura ao estúdio (ATIVA de fato só no webhook,
    # após reconciliação do pagamento aprovado).
    assinatura = await get_assinatura(session, usuario.estudio_id)
    if assinatura is not None:
        assinatura.plano_slug = dados.plano_slug
        assinatura.ciclo = dados.ciclo
        assinatura.gateway = "mercadopago"
        if resultado.get("id"):
            assinatura.externo_id = str(resultado.get("id"))

    await log_event(
        session,
        acao="pagamento.checkout.criado",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="cobranca",
        entidade_id=str(cob_id),
        dados={"plano": dados.plano_slug, "ciclo": dados.ciclo, "tipo": tipo_checkout},
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
    evento.x_request_id = x_request_id
    session.add(evento)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return {"status": "duplicado"}

    # P0-06 — reconciliação: NUNCA confia no corpo do webhook; consulta o gateway,
    # casa pela cobrança local (external_reference = cobranca.id) e só ativa a
    # assinatura se o pagamento foi aprovado E o valor pago == valor esperado.
    if tipo == "payment" and gateway.configurado():
        try:
            mp = await gateway.obter_pagamento(recurso_id)
            mp_status = (mp.get("status") or "").lower()
            evento.status = mp_status
            external_ref = mp.get("external_reference")
            valor_pago_cent = int(round(float(mp.get("transaction_amount") or 0) * 100))

            cobranca = None
            if external_ref:
                cobranca = await session.scalar(
                    select(Cobranca).where(Cobranca.external_reference == str(external_ref))
                )

            # Registra/atualiza o Pagamento local (dedup por gateway_payment_id).
            pagamento = await session.scalar(
                select(Pagamento).where(Pagamento.gateway_payment_id == recurso_id)
            )
            if pagamento is None:
                pagamento = Pagamento(
                    estudio_id=cobranca.estudio_id if cobranca else None,
                    cobranca_id=cobranca.id if cobranca else None,
                    gateway="mercadopago",
                    gateway_payment_id=recurso_id,
                    status=_map_status_pagamento(mp_status),
                    payment_type=mp.get("payment_type_id"),
                    payment_method_id=mp.get("payment_method_id"),
                    valor_centavos=valor_pago_cent or None,
                    payload_minimo_json={
                        "status": mp_status,
                        "external_reference": external_ref,
                        "transaction_amount": mp.get("transaction_amount"),
                        "currency_id": mp.get("currency_id"),
                        "payment_type_id": mp.get("payment_type_id"),
                    },
                )
                session.add(pagamento)
                await session.flush()
            else:
                pagamento.status = _map_status_pagamento(mp_status)
            evento.pagamento_id = pagamento.id
            if cobranca:
                evento.estudio_id = cobranca.estudio_id

            if cobranca and mp_status == "approved":
                if valor_pago_cent != cobranca.valor_centavos:
                    # Valor divergente → NÃO ativa. Sinaliza para revisão manual.
                    logger.warning(
                        "webhook_valor_divergente",
                        extra={"extra": {
                            "cobranca": str(cobranca.id),
                            "esperado_centavos": cobranca.valor_centavos,
                            "pago_centavos": valor_pago_cent,
                        }},
                    )
                    await log_event(
                        session,
                        acao="pagamento.valor_divergente",
                        estudio_id=cobranca.estudio_id,
                        entidade="cobranca",
                        entidade_id=str(cobranca.id),
                        dados={
                            "esperado_centavos": cobranca.valor_centavos,
                            "pago_centavos": valor_pago_cent,
                        },
                    )
                else:
                    cobranca.status = StatusCobranca.PAGA
                    pagamento.reconciliado_em = datetime.now(UTC)
                    pagamento.pago_em = datetime.now(UTC)
                    assinatura = await session.scalar(
                        select(Assinatura).where(Assinatura.estudio_id == cobranca.estudio_id)
                    )
                    if assinatura:
                        ja_ativa = assinatura.status == StatusAssinatura.ATIVA
                        assinatura.status = StatusAssinatura.ATIVA
                        assinatura.gateway = "mercadopago"
                        evento.assinatura_id = assinatura.id
                        if not ja_ativa:
                            await log_event(
                                session,
                                acao="assinatura.activated",
                                estudio_id=assinatura.estudio_id,
                                entidade="assinatura",
                                entidade_id=str(assinatura.id),
                                dados={"gateway": "mercadopago", "cobranca": str(cobranca.id)},
                            )

            # Estorno/chargeback → suspende a assinatura (proteção de receita).
            elif cobranca and mp_status in ("refunded", "charged_back"):
                assinatura = await session.scalar(
                    select(Assinatura).where(Assinatura.estudio_id == cobranca.estudio_id)
                )
                if assinatura and assinatura.status == StatusAssinatura.ATIVA:
                    assinatura.status = StatusAssinatura.SUSPENSA
                    await log_event(
                        session,
                        acao="assinatura.suspended",
                        estudio_id=assinatura.estudio_id,
                        entidade="assinatura",
                        entidade_id=str(assinatura.id),
                        dados={"motivo": mp_status, "cobranca": str(cobranca.id)},
                    )

            evento.processado = True
        except GatewayPagamentoError as exc:
            logger.warning("webhook_reconciliacao_falhou", extra={"extra": {"erro": str(exc)}})

    # Recorrência mensal (preapproval): o evento "payment" NÃO cobre o ciclo
    # mensal, que é uma assinatura recorrente. Reconcilia consultando o
    # preapproval no gateway e ativa a assinatura quando autorizada — mesma regra
    # anti-fraude do pagamento avulso: casa pela cobrança local (external_reference),
    # valida o valor mensal e nunca confia no corpo do webhook. Falha de cobrança
    # recorrente faz o MP pausar/cancelar o preapproval, o que suspende o acesso.
    elif tipo == "preapproval" and gateway.configurado():
        try:
            pre = await gateway.obter_preapproval(recurso_id)
            pre_status = (pre.get("status") or "").lower()
            evento.status = pre_status
            external_ref = pre.get("external_reference")
            valor_mensal_cent = int(
                round(float((pre.get("auto_recurring") or {}).get("transaction_amount") or 0) * 100)
            )

            cobranca = None
            if external_ref:
                cobranca = await session.scalar(
                    select(Cobranca).where(Cobranca.external_reference == str(external_ref))
                )

            if cobranca:
                evento.estudio_id = cobranca.estudio_id
                assinatura = await session.scalar(
                    select(Assinatura).where(Assinatura.estudio_id == cobranca.estudio_id)
                )

                if pre_status == "authorized":
                    if valor_mensal_cent and valor_mensal_cent != cobranca.valor_centavos:
                        # Valor recorrente divergente → NÃO ativa (revisão manual).
                        logger.warning(
                            "webhook_valor_divergente",
                            extra={"extra": {
                                "cobranca": str(cobranca.id),
                                "esperado_centavos": cobranca.valor_centavos,
                                "pago_centavos": valor_mensal_cent,
                            }},
                        )
                        await log_event(
                            session,
                            acao="pagamento.valor_divergente",
                            estudio_id=cobranca.estudio_id,
                            entidade="cobranca",
                            entidade_id=str(cobranca.id),
                            dados={
                                "esperado_centavos": cobranca.valor_centavos,
                                "pago_centavos": valor_mensal_cent,
                                "via": "preapproval",
                            },
                        )
                    else:
                        cobranca.status = StatusCobranca.PAGA
                        if assinatura:
                            ja_ativa = assinatura.status == StatusAssinatura.ATIVA
                            assinatura.status = StatusAssinatura.ATIVA
                            assinatura.gateway = "mercadopago"
                            evento.assinatura_id = assinatura.id
                            if not ja_ativa:
                                await log_event(
                                    session,
                                    acao="assinatura.activated",
                                    estudio_id=assinatura.estudio_id,
                                    entidade="assinatura",
                                    entidade_id=str(assinatura.id),
                                    dados={
                                        "gateway": "mercadopago",
                                        "cobranca": str(cobranca.id),
                                        "via": "preapproval",
                                    },
                                )

                # Assinatura recorrente cancelada/pausada (ex.: falha de cobrança)
                # → suspende o acesso (proteção de receita).
                elif pre_status in ("cancelled", "paused"):
                    if assinatura and assinatura.status == StatusAssinatura.ATIVA:
                        assinatura.status = StatusAssinatura.SUSPENSA
                        await log_event(
                            session,
                            acao="assinatura.suspended",
                            estudio_id=assinatura.estudio_id,
                            entidade="assinatura",
                            entidade_id=str(assinatura.id),
                            dados={
                                "motivo": pre_status,
                                "cobranca": str(cobranca.id),
                                "via": "preapproval",
                            },
                        )

            evento.processado = True
        except GatewayPagamentoError as exc:
            logger.warning("webhook_reconciliacao_falhou", extra={"extra": {"erro": str(exc)}})

    await session.commit()
    return {"status": "ok"}
