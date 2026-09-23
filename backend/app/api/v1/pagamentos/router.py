"""Router de Pagamentos — checkout (Mercado Pago) e webhook.

Trava de segurança: a criação de cobrança real exige `settings.PAGAMENTOS_GO_LIVE`
(Fly secret) ligada. Sem isso, `/checkout` responde 503 — o código fica pronto,
mas NÃO cobra ninguém até o go-live explícito.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from zoneinfo import ZoneInfo

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Request,
    status,
)
from pydantic import BaseModel
from sqlalchemy import CursorResult, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual, require_role
from app.core.config import settings
from app.core.database import get_session
from app.core.documento_fiscal import campos_fiscais_faltando
from app.core.documento_fiscal import formatar as formatar_documento
from app.core.email import enviar_comprovante_pagamento
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
from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.services.assinatura import get_assinatura, periodo_para_ciclo
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


# Meio de pagamento do MP → texto do comprovante.
_MEIO_PAGAMENTO = {
    "credit_card": "Cartão de crédito",
    "debit_card": "Cartão de débito",
    "bank_transfer": "Pix",
    "ticket": "Boleto",
    "account_money": "Saldo em conta",
}

TZ_BR = ZoneInfo("America/Sao_Paulo")


def _nome_plano(slug: str) -> str:
    plano = get_plano(slug)
    return plano["nome"] if plano else slug


def _fmt_brl(centavos: int) -> str:
    return f"R$ {centavos / 100:_.2f}".replace(".", ",").replace("_", ".")


def _fmt_data_br(quando: datetime | None) -> str:
    quando = quando or datetime.now(UTC)
    if quando.tzinfo is None:
        quando = quando.replace(tzinfo=UTC)
    return quando.astimezone(TZ_BR).strftime("%d/%m/%Y às %H:%M")


async def _reservar_comprovante(session: AsyncSession, cobranca: Cobranca) -> bool:
    """Reserva o envio do comprovante desta cobrança. True = ganhou a corrida.

    A aprovação chega por 3 caminhos que podem rodar ao mesmo tempo (webhook de
    payment, webhook de preapproval e /reconciliar). O UPDATE condicional trava
    a linha no Postgres, então apenas uma transação vê rowcount 1 — as demais
    saem sem enviar nada. Sem isso o cliente receberia comprovante duplicado.
    """
    resultado = cast(
        "CursorResult[Any]",
        await session.execute(
            update(Cobranca)
            .where(
                Cobranca.id == cobranca.id,
                Cobranca.comprovante_enviado_em.is_(None),
            )
            .values(comprovante_enviado_em=datetime.now(UTC))
            # O objeto em memória não é usado depois deste ponto; sincronizar
            # custaria um SELECT extra dentro do webhook.
            .execution_options(synchronize_session=False)
        ),
    )
    return (resultado.rowcount or 0) == 1


async def _agendar_comprovante(
    session: AsyncSession,
    background: BackgroundTasks | None,
    cobranca: Cobranca,
    pagamento: Pagamento | None,
    via: str,
) -> None:
    """Agenda o comprovante de pagamento — no máximo um por cobrança.

    Falhar aqui nunca pode derrubar a confirmação do pagamento: o dinheiro já
    entrou e a assinatura já foi ativada. Por isso tudo roda dentro de try/except
    e o envio real acontece em background, fora da resposta ao gateway.
    """
    if background is None:
        return
    try:
        if not await _reservar_comprovante(session, cobranca):
            return

        estudio = await session.get(Estudio, cobranca.estudio_id)
        destino = None
        if cobranca.created_by_usuario_id:
            destino = await session.get(Usuario, cobranca.created_by_usuario_id)
        if destino is None:
            destino = await session.scalar(
                select(Usuario)
                .where(
                    Usuario.estudio_id == cobranca.estudio_id,
                    Usuario.tipo == TipoUsuario.ADMIN,
                    Usuario.ativo.is_(True),
                )
                .order_by(Usuario.criado_em)
                .limit(1)
            )
        if destino is None or estudio is None:
            logger.warning(
                "comprovante_sem_destinatario",
                extra={"extra": {"cobranca": str(cobranca.id)}},
            )
            return

        assinatura = await session.scalar(
            select(Assinatura).where(Assinatura.estudio_id == cobranca.estudio_id)
        )
        periodo = None
        if assinatura and assinatura.periodo_inicio and assinatura.periodo_fim:
            periodo = (
                f"{assinatura.periodo_inicio.astimezone(TZ_BR):%d/%m/%Y}"
                f" a {assinatura.periodo_fim.astimezone(TZ_BR):%d/%m/%Y}"
            )

        background.add_task(
            enviar_comprovante_pagamento,
            destinatario_email=destino.email,
            nome_estudio=estudio.nome,
            razao_social=estudio.razao_social,
            documento_formatado=formatar_documento(estudio.documento) or None,
            plano_nome=_nome_plano(cobranca.plano_slug),
            ciclo=cobranca.ciclo,
            valor_formatado=_fmt_brl(cobranca.valor_centavos),
            data_formatada=_fmt_data_br(pagamento.pago_em if pagamento else None),
            meio_pagamento=_MEIO_PAGAMENTO.get(pagamento.payment_type or "") if pagamento else None,
            referencia=cobranca.external_reference,
            periodo_texto=periodo,
        )
        logger.info(
            "comprovante_agendado",
            extra={"extra": {"cobranca": str(cobranca.id), "via": via}},
        )
    except Exception as exc:  # nunca derruba a confirmação do pagamento
        # A reserva já foi carimbada; sem liberá-la o comprovante nunca mais
        # sairia (a reconciliação seguinte veria "já enviado").
        try:
            await session.execute(
                update(Cobranca)
                .where(Cobranca.id == cobranca.id)
                .values(comprovante_enviado_em=None)
                .execution_options(synchronize_session=False)
            )
        except Exception:
            logger.warning("comprovante_reserva_nao_liberada", extra={"extra": {
                "cobranca": str(cobranca.id)}})
        logger.warning(f"Falha ao agendar comprovante de pagamento: {exc}")


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

    # Nota fiscal exige CPF/CNPJ e endereço do tomador. Cobrar antes do checkout
    # evita a alternativa ruim: descobrir o dado faltando só na hora de emitir,
    # com o dinheiro já recebido. O frontend abre o modal de dados fiscais e
    # repete o checkout.
    estudio = await session.get(Estudio, usuario.estudio_id)
    faltando = campos_fiscais_faltando(estudio)
    if faltando:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"codigo": "dados_fiscais_incompletos", "campos": faltando},
        )

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
        valor_centavos=valor_venda_centavos(plano, dados.ciclo),
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


def _parse_next_payment(valor: str | None) -> datetime | None:
    """Converte o next_payment_date do preapproval (ISO com offset) em datetime
    UTC-aware; None se ausente/inválido."""
    if not valor:
        return None
    try:
        dt = datetime.fromisoformat(valor)
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _resumo_com_cancelamento(assinatura: Assinatura | None) -> dict:
    """Resumo da assinatura + flag `cancelar_no_fim` (o `resumo` do service não a
    expõe e está fora do escopo desta raia). O frontend usa a flag para mostrar
    'Cancelamento agendado' em vez do botão de cancelar."""
    dados = resumo_assinatura(assinatura)
    dados["cancelar_no_fim"] = bool(assinatura.cancelar_no_fim) if assinatura else False
    return dados


@router.get("/assinatura")
async def status_assinatura(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Status da assinatura do estúdio (plano, trial, dias restantes) para o frontend."""
    assinatura = await get_assinatura(session, usuario.estudio_id)
    return _resumo_com_cancelamento(assinatura)


class PagamentoHistoricoItem(BaseModel):
    id: uuid.UUID
    data: datetime
    valor_centavos: int
    plano_nome: str
    ciclo: str
    status: str
    meio_pagamento: str | None = None


@router.get("/historico", response_model=list[PagamentoHistoricoItem])
async def historico_pagamentos(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Pagamentos já reconciliados do estúdio — base dos comprovantes/notas."""
    linhas = (
        await session.execute(
            select(Pagamento, Cobranca)
            .join(Cobranca, Pagamento.cobranca_id == Cobranca.id)
            .where(Pagamento.estudio_id == usuario.estudio_id)
            .order_by(Pagamento.pago_em.desc().nullslast(), Pagamento.criado_em.desc())
            .limit(60)
        )
    ).all()

    return [
        PagamentoHistoricoItem(
            id=pagamento.id,
            data=pagamento.pago_em or pagamento.criado_em,
            valor_centavos=pagamento.valor_centavos,
            plano_nome=_nome_plano(cobranca.plano_slug),
            ciclo=cobranca.ciclo,
            status=pagamento.status.value,
            meio_pagamento=_MEIO_PAGAMENTO.get(pagamento.payment_type or ""),
        )
        for pagamento, cobranca in linhas
    ]


@router.post("/cancelar")
async def cancelar_assinatura(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Cancelamento in-app da assinatura (ADMIN do estúdio).

    Padrão SaaS justo: NÃO revoga o acesso na hora — apenas agenda o fim
    (`cancelar_no_fim=True`), mantendo o acesso até o término do período/trial já
    pago, e desliga a recorrência no gateway para não haver nova cobrança.

    - Mensal recorrente (preapproval): cancela o preapproval no Mercado Pago.
    - Avulso (trimestral/semestral/anual): não há recorrência no gateway — só
      marca localmente (o período pago segue até `periodo_fim`).

    Idempotente: com o cancelamento já agendado, a 2ª chamada não repete o efeito
    nem fala de novo com o gateway. Reembolso (CDC 7 dias) segue manual pelo painel.
    """
    assinatura = await get_assinatura(session, usuario.estudio_id)
    if assinatura is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma assinatura para cancelar.",
        )

    # Idempotência: já agendado → devolve o resumo sem tocar no gateway de novo.
    if assinatura.cancelar_no_fim:
        return _resumo_com_cancelamento(assinatura)

    # Mensal recorrente tem preapproval no MP a cancelar; avulso não. Se o MP
    # falhar, aborta ANTES de marcar o estado local — nada de assinatura marcada
    # como cancelada localmente enquanto a recorrência segue viva no gateway.
    if assinatura.ciclo == "mensal" and assinatura.externo_id and gateway.configurado():
        try:
            # Lê o fim do ciclo já pago ANTES de cancelar (o MP limpa o
            # next_payment_date após o cancelamento). O acesso segue até essa data.
            pre = await gateway.obter_preapproval(assinatura.externo_id)
            fim_ciclo = _parse_next_payment(pre.get("next_payment_date"))
            await gateway.cancelar_preapproval(assinatura.externo_id)
        except GatewayPagamentoError as exc:
            logger.warning("cancelamento_mp_falhou", extra={"extra": {"erro": str(exc)}})
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível cancelar no gateway agora. Tente novamente em instantes.",
            ) from exc
        # Mantém o acesso até o fim do ciclo pago (enforcement lazy via periodo_fim).
        # Sem esse fim, o webhook `cancelled` que o MP dispara agora suspenderia o
        # acesso na hora — quebrando a promessa "use até o fim do período".
        assinatura.periodo_fim = fim_ciclo or (datetime.now(UTC) + timedelta(days=31))

    # NÃO mexe em `status` (segue ATIVA): o acesso vale por acesso_liberado() até o
    # trial/periodo_fim. O webhook `preapproval cancelled` respeita cancelar_no_fim
    # e não suspende — a expiração é lazy pelo periodo_fim gravado acima.
    assinatura.cancelar_no_fim = True

    await log_event(
        session,
        acao="assinatura.cancelamento_agendado",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="assinatura",
        entidade_id=str(assinatura.id),
        dados={"ciclo": assinatura.ciclo, "via": "in_app"},
        commit=True,
    )
    return _resumo_com_cancelamento(assinatura)


async def _reconciliar_cobranca_via_mp(
    session: AsyncSession,
    cobranca: Cobranca,
    background: BackgroundTasks | None = None,
) -> str:
    """Reconciliação ATIVA (sem depender de webhook): consulta o Mercado Pago pelo
    pagamento/assinatura da cobrança e ativa se aprovado. Idempotente — rede de
    segurança para o caso de um webhook se perder. Mesma regra anti-fraude do
    webhook: casa pela cobrança local e valida o valor."""
    if not gateway.configurado():
        return "gateway_off"

    assinatura = await session.scalar(
        select(Assinatura).where(Assinatura.estudio_id == cobranca.estudio_id)
    )

    async def _ativar(pagamento: Pagamento | None = None) -> None:
        cobranca.status = StatusCobranca.PAGA
        if assinatura:
            ja_ativa = assinatura.status == StatusAssinatura.ATIVA
            assinatura.status = StatusAssinatura.ATIVA
            assinatura.gateway = "mercadopago"
            # Período pago vigente (enforcement lazy): avulso ganha periodo_fim
            # (+N meses + carência); mensal recorrente fica sem fim (o MP pausa
            # o preapproval na falha de renovação e o webhook suspende).
            assinatura.periodo_inicio, assinatura.periodo_fim = periodo_para_ciclo(
                cobranca.ciclo
            )
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
                        "via": "reconcile_ativo",
                    },
                )
        await _agendar_comprovante(
            session, background, cobranca, pagamento, via="reconcile_ativo"
        )

    # Mensal → assinatura recorrente (preapproval)
    if cobranca.ciclo == "mensal" and cobranca.gateway_preapproval_id:
        pre = await gateway.obter_preapproval(cobranca.gateway_preapproval_id)
        pre_status = (pre.get("status") or "").lower()
        valor = int(round(float((pre.get("auto_recurring") or {}).get("transaction_amount") or 0) * 100))
        if pre_status != "authorized":
            return f"preapproval_{pre_status or 'sem_status'}"
        if valor and valor != cobranca.valor_centavos:
            return "valor_divergente"
        await _ativar()
        return "ativada"

    # Avulso → pagamento único; busca o pagamento aprovado pela external_reference
    data = await gateway.buscar_pagamentos_por_referencia(cobranca.external_reference or "")
    resultados = data.get("results") or []
    aprovado = next((r for r in resultados if (r.get("status") or "").lower() == "approved"), None)
    if not aprovado:
        return "sem_pagamento_aprovado"
    valor = int(round(float(aprovado.get("transaction_amount") or 0) * 100))
    if valor != cobranca.valor_centavos:
        return "valor_divergente"
    pid = str(aprovado.get("id"))
    pagamento = await session.scalar(select(Pagamento).where(Pagamento.gateway_payment_id == pid))
    if pagamento is None:
        pagamento = Pagamento(
            estudio_id=cobranca.estudio_id,
            cobranca_id=cobranca.id,
            gateway="mercadopago",
            gateway_payment_id=pid,
            status=_map_status_pagamento("approved"),
            payment_type=aprovado.get("payment_type_id"),
            payment_method_id=aprovado.get("payment_method_id"),
            valor_centavos=valor,
            payload_minimo_json={
                "status": "approved",
                "external_reference": cobranca.external_reference,
                "transaction_amount": aprovado.get("transaction_amount"),
            },
        )
        session.add(pagamento)
        await session.flush()
    pagamento.reconciliado_em = datetime.now(UTC)
    pagamento.pago_em = datetime.now(UTC)
    await _ativar(pagamento)
    return "ativada"


@router.post("/reconciliar")
async def reconciliar_pendentes(
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Rede de segurança: consulta o Mercado Pago e reconcilia cobranças pendentes
    do estúdio (caso o webhook de pagamento se perca). Chamado pelo frontend ao
    voltar do checkout. Idempotente e seguro de chamar várias vezes."""
    cobrancas = (
        await session.scalars(
            select(Cobranca)
            .where(
                Cobranca.estudio_id == usuario.estudio_id,
                Cobranca.status.in_(
                    [StatusCobranca.CRIADA, StatusCobranca.ENVIADA_GATEWAY, StatusCobranca.PENDENTE]
                ),
            )
            .order_by(Cobranca.criado_em.desc())
            .limit(5)
        )
    ).all()

    ativada = False
    for cob in cobrancas:
        try:
            if await _reconciliar_cobranca_via_mp(session, cob, background) == "ativada":
                ativada = True
        except GatewayPagamentoError as exc:
            logger.warning("reconciliacao_ativa_falhou", extra={"extra": {"erro": str(exc)}})

    await session.commit()
    assinatura = await get_assinatura(session, usuario.estudio_id)
    return {"ativada": ativada, "assinatura": resumo_assinatura(assinatura)}


@router.post("/webhook", status_code=200)
async def webhook_mercadopago(
    request: Request,
    background: BackgroundTasks,
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
            if pagamento is None and cobranca is None:
                # Pagamento sem cobrança local correspondente (external_reference
                # ausente ou estranho). A tabela `pagamentos` exige tenant
                # (estudio_id NOT NULL) — criar aqui estouraria IntegrityError e
                # derrubaria o webhook. Não persistimos registro órfão: o evento
                # já está no inbox para auditoria/forense.
                logger.warning(
                    "webhook_pagamento_sem_cobranca",
                    extra={"extra": {
                        "recurso_id": recurso_id,
                        "external_reference": external_ref,
                    }},
                )
            else:
                if pagamento is None:
                    # Ramo else + pagamento None ⇒ cobranca não-None (garantido
                    # pela condição acima); assert deixa isso explícito ao checker.
                    assert cobranca is not None
                    pagamento = Pagamento(
                        estudio_id=cobranca.estudio_id,
                        cobranca_id=cobranca.id,
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
                    # cobranca truthy ⇒ passamos pelo ramo else acima ⇒ pagamento
                    # foi atribuído (criado ou existente); assert para o checker.
                    assert pagamento is not None
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
                        # Enforcement lazy: grava o período pago (avulso expira,
                        # mensal recorrente fica sem fim — ver periodo_para_ciclo).
                        assinatura.periodo_inicio, assinatura.periodo_fim = (
                            periodo_para_ciclo(cobranca.ciclo)
                        )
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
                    await _agendar_comprovante(
                        session, background, cobranca, pagamento, via="webhook_payment"
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
    elif tipo in ("preapproval", "subscription_preapproval") and gateway.configurado():
        # O Mercado Pago envia o tipo como "subscription_preapproval" (sistema novo
        # de Webhooks) ou "preapproval" (IPN legado) — tratamos ambos.
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
                            # Recorrente: periodo_fim=None (o MP pausa na falha
                            # de renovação; o webhook suspende o acesso).
                            assinatura.periodo_inicio, assinatura.periodo_fim = (
                                periodo_para_ciclo(cobranca.ciclo)
                            )
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
                        await _agendar_comprovante(
                            session, background, cobranca, None, via="webhook_preapproval"
                        )

                # Assinatura recorrente cancelada/pausada. Duas origens distintas:
                #  - Cancelamento AGENDADO pelo usuário (in-app, cancelar_no_fim=True):
                #    o /cancelar já gravou periodo_fim = fim do ciclo pago. NÃO
                #    suspende — o acesso segue até periodo_fim (expiração lazy),
                #    honrando "cancele quando quiser, use até o fim do período".
                #  - Cancelado/pausado pelo MP sem pedido do usuário (falha de
                #    cobrança) → suspende na hora (proteção de receita).
                elif pre_status in ("cancelled", "paused"):
                    if assinatura and assinatura.status == StatusAssinatura.ATIVA:
                        if assinatura.cancelar_no_fim:
                            await log_event(
                                session,
                                acao="assinatura.cancelamento_confirmado",
                                estudio_id=assinatura.estudio_id,
                                entidade="assinatura",
                                entidade_id=str(assinatura.id),
                                dados={
                                    "motivo": pre_status,
                                    "cobranca": str(cobranca.id),
                                    "via": "preapproval",
                                    "acesso_ate": (
                                        assinatura.periodo_fim.isoformat()
                                        if assinatura.periodo_fim
                                        else None
                                    ),
                                },
                            )
                        else:
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
