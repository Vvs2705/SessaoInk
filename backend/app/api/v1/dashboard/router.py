"""Router de Dashboard — visão executiva e indicadores."""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Date, String, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import exigir_assinatura_ativa, get_usuario_atual
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusFinanceiro, StatusOperacional
from app.models.cliente import Cliente
from app.models.financeiro import (
    EstoqueItem,
    Lancamento,
    StatusLancamento,
    TipoLancamento,
)
from app.models.usuario import Usuario

# Enforcement de assinatura: todo o módulo exige trial vigente ou assinatura
# ativa (402 caso contrário) — rotas de pagamento/config/LGPD ficam isentas.
router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(exigir_assinatura_ativa)],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ResumoDashboardFinanceiro(BaseModel):
    entradas_pagas: float
    entradas_pendentes: float
    saidas_pagas: float
    saidas_pendentes: float
    saldo_realizado: float
    saldo_previsto: float
    sinais_pagos: float
    sinais_pendentes: float
    comissoes_pagas: float
    comissoes_pendentes: float
    lucro_estimado: float
    ticket_medio: float


class ResumoDashboardOperacional(BaseModel):
    orcamentos_pendentes: int
    sessoes_hoje: int
    sessoes_sete_dias: int
    aguardando_sinal: int
    clientes_novos: int
    conversao_orcamento_sessao: float  # percentual


class FluxoDia(BaseModel):
    dia: str  # YYYY-MM-DD
    entradas: float
    saidas: float


class ArtistaGrafico(BaseModel):
    artista_nome: str
    valor: float


class MetodoGrafico(BaseModel):
    metodo: str
    valor: float


class CategoriaGrafico(BaseModel):
    categoria: str
    valor: float


class DashboardGraficos(BaseModel):
    fluxo_diario: list[FluxoDia]
    por_artista: list[ArtistaGrafico]
    por_metodo: list[MetodoGrafico]
    por_categoria: list[CategoriaGrafico]


class DashboardAlerta(BaseModel):
    tipo: str  # "ORCAMENTO_PARADO" | "SINAL_PENDENTE" | "COMISSAO_PENDENTE" | "SEM_PAGAMENTO" | "ESTOQUE_BAIXO"
    mensagem: str
    link: str | None = None


class ResumoDashboardResponse(BaseModel):
    periodo: dict[str, str]
    financeiro: ResumoDashboardFinanceiro
    operacional: ResumoDashboardOperacional
    graficos: DashboardGraficos
    alertas: list[DashboardAlerta]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/resumo", response_model=ResumoDashboardResponse)
async def resumo_dashboard(
    inicio: date = Query(None),
    fim: date = Query(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    estudio_id = usuario.estudio_id
    agora = datetime.now(UTC)

    # Datas padrão: mês atual
    if not inicio:
        inicio = date(agora.year, agora.month, 1)
    if not fim:
        # Fim do mês atual
        next_month = agora.replace(day=28) + timedelta(days=4)
        fim = (next_month - timedelta(days=next_month.day)).date()

    inicio_dt = datetime.combine(inicio, datetime.min.time(), tzinfo=UTC)
    fim_dt = datetime.combine(fim, datetime.max.time(), tzinfo=UTC)

    # 1. Indicadores Financeiros
    data_col = func.coalesce(
        Lancamento.competencia,
        cast(Lancamento.data_realizada, Date),
        cast(Lancamento.data_prevista, Date),
    )
    periodo_filter = and_(
        Lancamento.estudio_id == estudio_id,
        data_col >= inicio,
        data_col <= fim,
    )

    res_financeiro = await session.execute(
        select(
            Lancamento.tipo,
            Lancamento.status,
            func.sum(Lancamento.valor).label("total")
        )
        .where(periodo_filter)
        .group_by(Lancamento.tipo, Lancamento.status)
    )
    rows_fin = res_financeiro.all()

    entradas_pagas = 0.0
    entradas_pendentes = 0.0
    saidas_pagas = 0.0
    saidas_pendentes = 0.0
    sinais_pagos = 0.0
    sinais_pendentes = 0.0
    comissoes_pagas = 0.0
    comissoes_pendentes = 0.0

    for r in rows_fin:
        tipo = r.tipo
        status_val = r.status
        tot = float(r.total or 0.0)

        # Entrada/Sinal/Reserva
        if tipo in (TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA):
            if status_val == StatusLancamento.PAGO:
                entradas_pagas += tot
            elif status_val == StatusLancamento.PENDENTE:
                entradas_pendentes += tot

        # Saida
        if tipo == TipoLancamento.SAIDA:
            if status_val == StatusLancamento.PAGO:
                saidas_pagas += tot
            elif status_val == StatusLancamento.PENDENTE:
                saidas_pendentes += tot

        # Sinal/Reserva
        if tipo in (TipoLancamento.SINAL, TipoLancamento.RESERVA):
            if status_val == StatusLancamento.PAGO:
                sinais_pagos += tot
            elif status_val == StatusLancamento.PENDENTE:
                sinais_pendentes += tot

        # Comissões
        if tipo == TipoLancamento.COMISSAO:
            if status_val == StatusLancamento.PAGO:
                comissoes_pagas += tot
                saidas_pagas += tot
            elif status_val == StatusLancamento.PENDENTE:
                comissoes_pendentes += tot
                saidas_pendentes += tot

    saldo_realizado = entradas_pagas - saidas_pagas
    saldo_previsto = (entradas_pagas + entradas_pendentes) - (saidas_pagas + saidas_pendentes)
    lucro_estimado = entradas_pagas - saidas_pagas

    # Ticket médio (média de valor de atendimentos finalizados com preço)
    ticket_res = await session.execute(
        select(func.coalesce(func.avg(Atendimento.valor_total), 0.0)).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.FINALIZADO,
            Atendimento.data_sessao >= inicio_dt,
            Atendimento.data_sessao <= fim_dt,
        )
    )
    ticket_medio = float(ticket_res.scalar() or 0.0)

    financeiro_dto = ResumoDashboardFinanceiro(
        entradas_pagas=entradas_pagas,
        entradas_pendentes=entradas_pendentes,
        saidas_pagas=saidas_pagas,
        saidas_pendentes=saidas_pendentes,
        saldo_realizado=saldo_realizado,
        saldo_previsto=saldo_previsto,
        sinais_pagos=sinais_pagos,
        sinais_pendentes=sinais_pendentes,
        comissoes_pagas=comissoes_pagas,
        comissoes_pendentes=comissoes_pendentes,
        lucro_estimado=lucro_estimado,
        ticket_medio=ticket_medio,
    )

    # 2. Indicadores Operacionais
    # Orçamentos pendentes (SOLICITADO / EM_ANALISE)
    orc_pend_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional.in_([StatusOperacional.SOLICITADO, StatusOperacional.EM_ANALISE])
        )
    )
    orc_pendentes = orc_pend_res.scalar() or 0

    # Sessões de hoje
    hoje_inicio = datetime.combine(agora.date(), datetime.min.time(), tzinfo=UTC)
    hoje_fim = datetime.combine(agora.date(), datetime.max.time(), tzinfo=UTC)
    sess_hoje_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional.in_([StatusOperacional.CONFIRMADO, StatusOperacional.EM_ATENDIMENTO]),
            Atendimento.data_sessao >= hoje_inicio,
            Atendimento.data_sessao <= hoje_fim
        )
    )
    sessoes_hoje = sess_hoje_res.scalar() or 0

    # Sessões nos próximos 7 dias
    sete_dias_fim = hoje_fim + timedelta(days=7)
    sess_sete_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional.in_([StatusOperacional.CONFIRMADO, StatusOperacional.EM_ATENDIMENTO]),
            Atendimento.data_sessao >= hoje_inicio,
            Atendimento.data_sessao <= sete_dias_fim
        )
    )
    sessoes_sete = sess_sete_res.scalar() or 0

    # Aguardando Sinal
    aguardando_sinal_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.AGUARDANDO_SINAL
        )
    )
    aguardando_sinal = aguardando_sinal_res.scalar() or 0

    # Clientes Novos
    cli_novos_res = await session.execute(
        select(func.count()).where(
            Cliente.estudio_id == estudio_id,
            Cliente.ativo,
            Cliente.criado_em >= inicio_dt,
            Cliente.criado_em <= fim_dt
        )
    )
    clientes_novos = cli_novos_res.scalar() or 0

    # Conversão de orçamento
    total_criados_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.criado_em >= inicio_dt,
            Atendimento.criado_em <= fim_dt
        )
    )
    total_criados = total_criados_res.scalar() or 0

    total_convertidos_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.criado_em >= inicio_dt,
            Atendimento.criado_em <= fim_dt,
            Atendimento.status_operacional.in_([
                StatusOperacional.CONFIRMADO,
                StatusOperacional.EM_ATENDIMENTO,
                StatusOperacional.FINALIZADO,
                StatusOperacional.RETOQUE
            ])
        )
    )
    total_convertidos = total_convertidos_res.scalar() or 0

    conversao = (total_convertidos / total_criados * 100.0) if total_criados > 0 else 0.0

    operacional_dto = ResumoDashboardOperacional(
        orcamentos_pendentes=orc_pendentes,
        sessoes_hoje=sessoes_hoje,
        sessoes_sete_dias=sessoes_sete,
        aguardando_sinal=aguardando_sinal,
        clientes_novos=clientes_novos,
        conversao_orcamento_sessao=round(conversao, 1),
    )

    # 3. Gráficos
    # Fluxo Diário
    fluxo_res = await session.execute(
        select(
            cast(data_col, String).label("dia"),
            func.sum(
                case(
                    (Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]), Lancamento.valor),
                    else_=0.0
                )
            ).label("entradas"),
            func.sum(
                case(
                    (Lancamento.tipo.in_([TipoLancamento.SAIDA, TipoLancamento.COMISSAO]), Lancamento.valor),
                    else_=0.0
                )
            ).label("saidas")
        )
        .where(and_(periodo_filter, Lancamento.status == StatusLancamento.PAGO))
        .group_by(cast(data_col, String))
        .order_by(cast(data_col, String))
    )
    fluxo_diario = [
        FluxoDia(dia=r.dia, entradas=float(r.entradas or 0), saidas=float(r.saidas or 0))
        for r in fluxo_res.all()
    ]

    # Receita por Artista
    art_res = await session.execute(
        select(
            Usuario.nome.label("nome"),
            func.sum(Lancamento.valor).label("total")
        )
        .join(Usuario, Lancamento.artista_id == Usuario.id)
        .where(and_(
            periodo_filter,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PAGO
        ))
        .group_by(Usuario.nome)
    )
    por_artista = [
        ArtistaGrafico(artista_nome=r.nome, valor=float(r.total or 0)) for r in art_res.all()
    ]

    # Receita por Forma de Pagamento
    metodo_res = await session.execute(
        select(
            Lancamento.forma_pagamento.label("metodo"),
            func.sum(Lancamento.valor).label("total")
        )
        .where(and_(
            periodo_filter,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.forma_pagamento.isnot(None)
        ))
        .group_by(Lancamento.forma_pagamento)
    )
    por_metodo = [
        MetodoGrafico(metodo=r.metodo.value if r.metodo else "Outro", valor=float(r.total or 0))
        for r in metodo_res.all()
    ]

    # Despesas por Categoria (Saída)
    cat_res = await session.execute(
        select(
            func.coalesce(Lancamento.categoria, "Sem Categoria").label("cat"),
            func.sum(Lancamento.valor).label("total")
        )
        .where(and_(
            periodo_filter,
            Lancamento.tipo == TipoLancamento.SAIDA,
            Lancamento.status == StatusLancamento.PAGO
        ))
        .group_by(Lancamento.categoria)
    )
    por_categoria = [
        CategoriaGrafico(categoria=r.cat, valor=float(r.total or 0)) for r in cat_res.all()
    ]

    graficos_dto = DashboardGraficos(
        fluxo_diario=fluxo_diario,
        por_artista=por_artista,
        por_metodo=por_metodo,
        por_categoria=por_categoria,
    )

    # 4. Alertas
    alertas = []

    # Alerta 1: Orçamentos sem resposta > 48h
    limiar_48h = agora - timedelta(hours=48)
    orc_48h_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional.in_([StatusOperacional.SOLICITADO, StatusOperacional.EM_ANALISE]),
            Atendimento.criado_em < limiar_48h
        )
    )
    orc_48h = orc_48h_res.scalar() or 0
    if orc_48h > 0:
        alertas.append(DashboardAlerta(
            tipo="ORCAMENTO_PARADO",
            mensagem=f"Temos {orc_48h} orçamentos solicitados há mais de 48 horas aguardando resposta.",
            link="/atendimentos"
        ))

    # Alerta 2: Sinais pendentes vencidos
    sinais_vencidos_res = await session.execute(
        select(func.count()).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.tipo.in_([TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PENDENTE,
            Lancamento.data_prevista < agora
        )
    )
    sinais_vencidos = sinais_vencidos_res.scalar() or 0
    if sinais_vencidos > 0:
        alertas.append(DashboardAlerta(
            tipo="SINAL_PENDENTE",
            mensagem=f"Existem {sinais_vencidos} sinais de reserva pendentes de pagamento vencidos.",
            link="/financeiro"
        ))

    # Alerta 3: Comissões pendentes
    comissoes_res = await session.execute(
        select(func.count()).where(
            Lancamento.estudio_id == estudio_id,
            Lancamento.tipo == TipoLancamento.COMISSAO,
            Lancamento.status == StatusLancamento.PENDENTE
        )
    )
    comissoes_pend = comissoes_res.scalar() or 0
    if comissoes_pend > 0:
        alertas.append(DashboardAlerta(
            tipo="COMISSAO_PENDENTE",
            mensagem=f"Temos {comissoes_pend} comissões pendentes para pagamento aos artistas.",
            link="/financeiro"
        ))

    # Alerta 4: Sessões finalizadas sem pagamento
    sessoes_sem_pg_res = await session.execute(
        select(func.count()).where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo,
            Atendimento.status_operacional == StatusOperacional.FINALIZADO,
            Atendimento.status_financeiro.in_([StatusFinanceiro.PENDENTE, StatusFinanceiro.PAGO_PARCIAL])
        )
    )
    sessoes_sem_pg = sessoes_sem_pg_res.scalar() or 0
    if sessoes_sem_pg > 0:
        alertas.append(DashboardAlerta(
            tipo="SEM_PAGAMENTO",
            mensagem=f"Temos {sessoes_sem_pg} sessões finalizadas com pagamento pendente ou parcial.",
            link="/atendimentos"
        ))

    # Alerta 5: Estoque abaixo do mínimo
    estoque_baixo_res = await session.execute(
        select(func.count()).where(
            EstoqueItem.estudio_id == estudio_id,
            EstoqueItem.ativo,
            EstoqueItem.quantidade_atual < EstoqueItem.quantidade_minima
        )
    )
    estoque_baixo = estoque_baixo_res.scalar() or 0
    if estoque_baixo > 0:
        alertas.append(DashboardAlerta(
            tipo="ESTOQUE_BAIXO",
            mensagem=f"Temos {estoque_baixo} itens no estoque abaixo da quantidade mínima recomendada.",
            link="/estoque"
        ))

    return ResumoDashboardResponse(
        periodo={"inicio": inicio.isoformat(), "fim": fim.isoformat()},
        financeiro=financeiro_dto,
        operacional=operacional_dto,
        graficos=graficos_dto,
        alertas=alertas,
    )
