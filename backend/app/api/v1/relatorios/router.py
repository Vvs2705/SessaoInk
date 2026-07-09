"""Router de Relatórios — métricas e resumos financeiros/operacionais."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import exigir_assinatura_ativa, require_role
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.financeiro import Lancamento, StatusLancamento, TipoLancamento
from app.models.usuario import TipoUsuario, Usuario

# Enforcement de assinatura: todo o módulo exige trial vigente ou assinatura
# ativa (402 caso contrário) — rotas de pagamento/config/LGPD ficam isentas.
router = APIRouter(
    prefix="/relatorios",
    tags=["relatorios"],
    dependencies=[Depends(exigir_assinatura_ativa)],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ResumoFinanceiro(BaseModel):
    periodo_dias: int
    receita_total: float
    receita_periodo: float
    variacao_percentual: float | None  # comparado com período anterior
    total_atendimentos: int
    atendimentos_confirmados: int
    atendimentos_finalizados: int
    ticket_medio: float | None
    sinais_recebidos: float


class StatusCount(BaseModel):
    status: str
    label: str
    total: int
    cor: str


class RelatorioStatusResponse(BaseModel):
    total_ativos: int
    por_status: list[StatusCount]


class ReceitaPorDia(BaseModel):
    data: str  # YYYY-MM-DD
    receita: float
    atendimentos: int


class RelatorioTemporalResponse(BaseModel):
    periodo_dias: int
    dados: list[ReceitaPorDia]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

STATUS_LABELS = {
    "SOLICITADO": ("Solicitado", "#87938F"),
    "EM_ANALISE": ("Em Análise", "#C36B3F"),
    "AGUARDANDO_SINAL": ("Aguardando Sinal", "#C36B3F"),
    "CONFIRMADO": ("Confirmado", "#2F9285"),
    "EM_ATENDIMENTO": ("Em Atendimento", "#2F9285"),
    "FINALIZADO": ("Finalizado", "#4CAF82"),
    "REAGENDADO": ("Reagendado", "#87938F"),
    "CANCELADO_CLIENTE": ("Cancelado", "#E35D5B"),
    "CANCELADO_ESTUDIO": ("Cancelado (estúdio)", "#E35D5B"),
    "NAO_COMPARECEU": ("Não Compareceu", "#E35D5B"),
    "RETOQUE": ("Retoque", "#2F9285"),
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/resumo", response_model=ResumoFinanceiro)
async def resumo_financeiro(
    periodo: int = Query(default=30, ge=7, le=365, description="Período em dias"),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),  # P0-03 relatorios = ADMIN
):
    """Resumo financeiro e operacional do estúdio.

    Compara o período atual com o período anterior de mesmo tamanho.
    """
    agora = datetime.now(UTC)
    inicio_atual = agora - timedelta(days=periodo)
    inicio_anterior = inicio_atual - timedelta(days=periodo)

    estudio_id = usuario.estudio_id

    # Receita total histórica (todos os lançamentos PAGO tipo ENTRADA/SINAL/COMISSAO)
    r_total = await session.execute(
        select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.COMISSAO]),
        )
    )
    receita_total = float(r_total.scalar())

    # Receita no período atual
    r_atual = await session.execute(
        select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.COMISSAO]),
            Lancamento.data_realizada >= inicio_atual,
        )
    )
    receita_periodo = float(r_atual.scalar())

    # Receita no período anterior (para comparativo)
    r_anterior = await session.execute(
        select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.COMISSAO]),
            Lancamento.data_realizada >= inicio_anterior,
            Lancamento.data_realizada < inicio_atual,
        )
    )
    receita_anterior = float(r_anterior.scalar())

    variacao = None
    if receita_anterior > 0:
        variacao = round(((receita_periodo - receita_anterior) / receita_anterior) * 100, 1)

    # Atendimentos
    r_total_atend = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
        )
    )
    total_atendimentos = r_total_atend.scalar()

    r_confirmados = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.CONFIRMADO,
        )
    )
    confirmados = r_confirmados.scalar()

    r_finalizados = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.FINALIZADO,
        )
    )
    finalizados = r_finalizados.scalar()

    # Ticket médio (valor_total dos atendimentos finalizados)
    r_ticket = await session.execute(
        select(func.avg(Atendimento.valor_total)).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.FINALIZADO,
            Atendimento.valor_total.isnot(None),
        )
    )
    ticket_val = r_ticket.scalar()
    ticket_medio = round(float(ticket_val), 2) if ticket_val else None

    # Sinais recebidos (lançamentos tipo SINAL PAGO)
    r_sinais = await session.execute(
        select(func.coalesce(func.sum(Lancamento.valor), 0)).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.tipo == TipoLancamento.SINAL,
        )
    )
    sinais = float(r_sinais.scalar())

    return ResumoFinanceiro(
        periodo_dias=periodo,
        receita_total=round(receita_total, 2),
        receita_periodo=round(receita_periodo, 2),
        variacao_percentual=variacao,
        total_atendimentos=total_atendimentos,
        atendimentos_confirmados=confirmados,
        atendimentos_finalizados=finalizados,
        ticket_medio=ticket_medio,
        sinais_recebidos=round(sinais, 2),
    )


@router.get("/por-status", response_model=RelatorioStatusResponse)
async def relatorio_por_status(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),  # P0-03 relatorios = ADMIN
):
    """Contagem de atendimentos ativos agrupados por status operacional."""
    result = await session.execute(
        select(Atendimento.status_operacional, func.count().label("total"))
        .where(
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo,
        )
        .group_by(Atendimento.status_operacional)
        .order_by(func.count().desc())
    )
    rows = result.all()

    total_ativos = sum(r.total for r in rows)

    por_status = [
        StatusCount(
            status=r.status_operacional.value,
            label=STATUS_LABELS.get(r.status_operacional.value, (r.status_operacional.value, "#87938F"))[0],
            total=r.total,
            cor=STATUS_LABELS.get(r.status_operacional.value, (r.status_operacional.value, "#87938F"))[1],
        )
        for r in rows
    ]

    return RelatorioStatusResponse(total_ativos=total_ativos, por_status=por_status)


@router.get("/temporal", response_model=RelatorioTemporalResponse)
async def relatorio_temporal(
    periodo: int = Query(default=30, ge=1, le=365, description="Período em dias"),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),  # P0-03 relatorios = ADMIN
):
    """Receita agrupada por dia nos últimos N dias."""

    agora = datetime.now(UTC)
    inicio = agora - timedelta(days=periodo)
    estudio_id = usuario.estudio_id

    result = await session.execute(
        select(
            func.date(Lancamento.data_realizada).label("dia"),
            func.coalesce(func.sum(Lancamento.valor), 0).label("receita"),
            func.count().label("atendimentos"),
        )
        .where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.COMISSAO]),
            Lancamento.data_realizada >= inicio,
        )
        .group_by(func.date(Lancamento.data_realizada))
        .order_by(func.date(Lancamento.data_realizada))
    )
    rows = result.all()

    dados = [
        ReceitaPorDia(
            data=str(row.dia),
            receita=float(row.receita),
            atendimentos=row.atendimentos,
        )
        for row in rows
    ]

    return RelatorioTemporalResponse(periodo_dias=periodo, dados=dados)

