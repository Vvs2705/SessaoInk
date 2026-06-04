"""Router de Financeiro."""

import csv
import io
import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Date, String, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual, require_role
from app.core.database import get_session
from app.models.financeiro import (
    FormaPagamentoFin,
    Lancamento,
    OrigemLancamento,
    Recorrencia,
    StatusLancamento,
    TipoLancamento,
)
from app.models.usuario import TipoUsuario, Usuario
from app.services.audit import log_event
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_lancamento_do_estudio,
    get_usuario_do_estudio,
)

router = APIRouter(prefix="/financeiro", tags=["financeiro"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LancamentoCreate(BaseModel):
    tipo: TipoLancamento
    descricao: str | None = None
    valor: float
    status: StatusLancamento | None = None
    forma_pagamento: FormaPagamentoFin | None = None
    data_prevista: datetime | None = None
    atendimento_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None

    categoria: str | None = None
    centro_custo: str | None = None
    origem: OrigemLancamento | None = OrigemLancamento.MANUAL
    valor_bruto: float | None = None
    valor_taxa: float | None = None
    valor_liquido: float | None = None
    competencia: date | None = None
    data_vencimento: datetime | None = None
    comissao_percentual: float | None = None
    lancamento_origem_id: uuid.UUID | None = None
    recorrencia: Recorrencia | None = Recorrencia.NENHUMA
    parcela_numero: int | None = None
    parcela_total: int | None = None
    grupo_id: uuid.UUID | None = None


class LancamentoUpdate(BaseModel):
    tipo: TipoLancamento | None = None
    descricao: str | None = None
    valor: float | None = None
    status: StatusLancamento | None = None
    forma_pagamento: FormaPagamentoFin | None = None
    data_prevista: datetime | None = None
    atendimento_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None

    categoria: str | None = None
    centro_custo: str | None = None
    origem: OrigemLancamento | None = None
    valor_bruto: float | None = None
    valor_taxa: float | None = None
    valor_liquido: float | None = None
    competencia: date | None = None
    data_vencimento: datetime | None = None
    comissao_percentual: float | None = None
    lancamento_origem_id: uuid.UUID | None = None
    recorrencia: Recorrencia | None = None
    parcela_numero: int | None = None
    parcela_total: int | None = None
    grupo_id: uuid.UUID | None = None
    motivo_cancelamento: str | None = None


class LancamentoResponse(BaseModel):
    id: uuid.UUID
    tipo: TipoLancamento
    descricao: str | None
    valor: float
    status: StatusLancamento
    forma_pagamento: FormaPagamentoFin | None
    data_prevista: datetime | None
    data_realizada: datetime | None

    categoria: str | None
    centro_custo: str | None
    origem: OrigemLancamento
    valor_bruto: float | None
    valor_taxa: float | None
    valor_liquido: float | None
    competencia: date | None
    data_vencimento: datetime | None
    comissao_percentual: float | None
    lancamento_origem_id: uuid.UUID | None
    recorrencia: Recorrencia
    parcela_numero: int | None
    parcela_total: int | None
    grupo_id: uuid.UUID | None
    criado_por_id: uuid.UUID | None
    cancelado_por_id: uuid.UUID | None
    cancelado_em: datetime | None
    motivo_cancelamento: str | None
    artista_id: uuid.UUID | None
    atendimento_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class ResumoResponse(BaseModel):
    receita_mes: float
    sinais_pendentes: float
    ticket_medio: float


class ConsolidadoResumo(BaseModel):
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


class CategoriaGrafico(BaseModel):
    categoria: str
    valor: float


class ArtistaGrafico(BaseModel):
    artista_nome: str
    valor: float


class FluxoDia(BaseModel):
    dia: str  # YYYY-MM-DD
    entradas: float
    saidas: float


class ConsolidadoGraficos(BaseModel):
    por_categoria: list[CategoriaGrafico]
    por_artista: list[ArtistaGrafico]
    fluxo_diario: list[FluxoDia]


class ConsolidadoResponse(BaseModel):
    resumo: ConsolidadoResumo
    graficos: ConsolidadoGraficos


class ComissaoGerarRequest(BaseModel):
    artista_id: uuid.UUID
    atendimento_id: uuid.UUID
    valor_servico: float
    comissao_percentual: float
    descricao: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[LancamentoResponse])
async def listar_lancamentos(
    tipo: TipoLancamento | None = Query(None),
    status: StatusLancamento | None = Query(None),
    categoria: str | None = Query(None),
    artista_id: uuid.UUID | None = Query(None),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(Lancamento.estudio_id == usuario.estudio_id)

    if tipo:
        query = query.where(Lancamento.tipo == tipo)
    if status:
        query = query.where(Lancamento.status == status)
    if categoria:
        query = query.where(Lancamento.categoria == categoria)
    if artista_id:
        query = query.where(Lancamento.artista_id == artista_id)

    if data_inicio or data_fim:
        data_col = func.coalesce(
            Lancamento.competencia,
            cast(Lancamento.data_realizada, Date),
            cast(Lancamento.data_prevista, Date),
        )
        if data_inicio:
            query = query.where(data_col >= data_inicio)
        if data_fim:
            query = query.where(data_col <= data_fim)

    query = query.order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/entradas", response_model=list[LancamentoResponse])
async def listar_entradas(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(
        Lancamento.estudio_id == usuario.estudio_id,
        Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]),
    ).order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/saidas", response_model=list[LancamentoResponse])
async def listar_saidas(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(
        Lancamento.estudio_id == usuario.estudio_id,
        Lancamento.tipo == TipoLancamento.SAIDA,
    ).order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/comissoes", response_model=list[LancamentoResponse])
async def listar_comissoes(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(
        Lancamento.estudio_id == usuario.estudio_id,
        Lancamento.tipo == TipoLancamento.COMISSAO,
    ).order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/reservas", response_model=list[LancamentoResponse])
async def listar_reservas(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(
        Lancamento.estudio_id == usuario.estudio_id,
        Lancamento.tipo.in_([TipoLancamento.SINAL, TipoLancamento.RESERVA]),
    ).order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    return result.scalars().all()


@router.get("/resumo", response_model=ResumoResponse)
async def resumo_financeiro(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    now = datetime.now(UTC)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=UTC)

    receita_res = await session.execute(
        select(func.sum(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.data_realizada >= start_of_month,
        )
    )
    receita = float(receita_res.scalar() or 0)

    sinais_res = await session.execute(
        select(func.sum(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PENDENTE,
        )
    )
    sinais = float(sinais_res.scalar() or 0)

    ticket_res = await session.execute(
        select(func.avg(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL, TipoLancamento.RESERVA]),
            Lancamento.status == StatusLancamento.PAGO,
        )
    )
    ticket = float(ticket_res.scalar() or 0)

    return ResumoResponse(
        receita_mes=receita,
        sinais_pendentes=sinais,
        ticket_medio=ticket,
    )


@router.get("/consolidado", response_model=ConsolidadoResponse)
async def consolidado_financeiro(
    inicio: date = Query(...),
    fim: date = Query(...),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    estudio_id = usuario.estudio_id

    # Base query for period
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

    # 1. Resumos
    res = await session.execute(
        select(
            Lancamento.tipo,
            Lancamento.status,
            func.sum(Lancamento.valor).label("total")
        )
        .where(periodo_filter)
        .group_by(Lancamento.tipo, Lancamento.status)
    )
    rows = res.all()

    entradas_pagas = 0.0
    entradas_pendentes = 0.0
    saidas_pagas = 0.0
    saidas_pendentes = 0.0
    sinais_pagos = 0.0
    sinais_pendentes = 0.0
    comissoes_pagas = 0.0
    comissoes_pendentes = 0.0

    for r in rows:
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

        # Sinal/Reserva individual
        if tipo in (TipoLancamento.SINAL, TipoLancamento.RESERVA):
            if status_val == StatusLancamento.PAGO:
                sinais_pagos += tot
            elif status_val == StatusLancamento.PENDENTE:
                sinais_pendentes += tot

        # Comissão individual
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

    resumo = ConsolidadoResumo(
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
    )

    # 2. Gráficos: Categoria de Despesa (Saída apenas)
    cat_res = await session.execute(
        select(
            func.coalesce(Lancamento.categoria, "Sem Categoria").label("cat"),
            func.sum(Lancamento.valor).label("total")
        )
        .where(and_(periodo_filter, Lancamento.tipo == TipoLancamento.SAIDA, Lancamento.status == StatusLancamento.PAGO))
        .group_by(Lancamento.categoria)
    )
    por_categoria = [
        CategoriaGrafico(categoria=r.cat, valor=float(r.total or 0)) for r in cat_res.all()
    ]

    # 3. Gráficos: Receita por Artista (Entrada/Sinal pago)
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

    # 4. Gráficos: Fluxo Diário (entradas vs saidas pagas)
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

    graficos = ConsolidadoGraficos(
        por_categoria=por_categoria,
        por_artista=por_artista,
        fluxo_diario=fluxo_diario,
    )

    return ConsolidadoResponse(resumo=resumo, graficos=graficos)


@router.post("/", response_model=LancamentoResponse, status_code=201)
async def criar_lancamento(
    dados: LancamentoCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    if dados.atendimento_id:
        await get_atendimento_do_estudio(
            session,
            atendimento_id=dados.atendimento_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Atendimento inválido ou não pertence ao seu estúdio",
        )

    if dados.artista_id:
        await get_usuario_do_estudio(
            session,
            usuario_id=dados.artista_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Artista inválido ou não pertence ao seu estúdio",
        )

    status_val = dados.status or StatusLancamento.PENDENTE
    data_realizada = None
    if status_val == StatusLancamento.PAGO:
        data_realizada = datetime.now(UTC)

    val_bruto = dados.valor_bruto if dados.valor_bruto is not None else dados.valor
    val_taxa = dados.valor_taxa if dados.valor_taxa is not None else 0.0
    val_liq = dados.valor_liquido if dados.valor_liquido is not None else (val_bruto - val_taxa)

    lanc = Lancamento(
        estudio_id=usuario.estudio_id,
        tipo=dados.tipo,
        descricao=dados.descricao,
        valor=dados.valor,
        status=status_val,
        forma_pagamento=dados.forma_pagamento,
        data_prevista=dados.data_prevista,
        data_realizada=data_realizada,
        atendimento_id=dados.atendimento_id,
        artista_id=dados.artista_id,

        categoria=dados.categoria,
        centro_custo=dados.centro_custo,
        origem=dados.origem or OrigemLancamento.MANUAL,
        valor_bruto=val_bruto,
        valor_taxa=val_taxa,
        valor_liquido=val_liq,
        competencia=dados.competencia or (dados.data_prevista.date() if dados.data_prevista else datetime.now(UTC).date()),
        data_vencimento=dados.data_vencimento or dados.data_prevista,
        comissao_percentual=dados.comissao_percentual,
        lancamento_origem_id=dados.lancamento_origem_id,
        recorrencia=dados.recorrencia or Recorrencia.NENHUMA,
        parcela_numero=dados.parcela_numero,
        parcela_total=dados.parcela_total,
        grupo_id=dados.grupo_id,
        criado_por_id=usuario.id,
    )
    session.add(lanc)
    await session.flush()
    await session.refresh(lanc)
    await log_event(
        session,
        acao="financeiro.created",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="lancamento",
        entidade_id=str(lanc.id),
        dados={"tipo": lanc.tipo.value, "valor": float(lanc.valor), "status": lanc.status.value},
    )
    return lanc


@router.patch("/{id}", response_model=LancamentoResponse)
async def atualizar_lancamento(
    id: uuid.UUID,
    dados: LancamentoUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    lanc = await get_lancamento_do_estudio(
        session,
        lancamento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Lançamento não encontrado",
    )

    if dados.atendimento_id is not None:
        await get_atendimento_do_estudio(
            session,
            atendimento_id=dados.atendimento_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Atendimento inválido ou não pertence ao seu estúdio",
        )

    if dados.artista_id is not None:
        await get_usuario_do_estudio(
            session,
            usuario_id=dados.artista_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Artista inválido ou não pertence ao seu estúdio",
        )

    campos = dados.model_dump(exclude_unset=True)

    if "status" in campos:
        novo_status = campos["status"]
        velho_status = lanc.status

        if novo_status == StatusLancamento.PAGO and velho_status != StatusLancamento.PAGO:
            lanc.data_realizada = datetime.now(UTC)
        elif novo_status != StatusLancamento.PAGO and velho_status == StatusLancamento.PAGO:
            lanc.data_realizada = None

        if novo_status == StatusLancamento.CANCELADO and velho_status != StatusLancamento.CANCELADO:
            lanc.cancelado_por_id = usuario.id
            lanc.cancelado_em = datetime.now(UTC)
            lanc.motivo_cancelamento = campos.get("motivo_cancelamento", "Cancelamento manual via dashboard")
        elif novo_status != StatusLancamento.CANCELADO and velho_status == StatusLancamento.CANCELADO:
            lanc.cancelado_por_id = None
            lanc.cancelado_em = None
            lanc.motivo_cancelamento = None

    for campo, valor in campos.items():
        if campo == "motivo_cancelamento":
            continue
        setattr(lanc, campo, valor)

    if "valor" in campos or "valor_taxa" in campos or "valor_bruto" in campos:
        bruto = lanc.valor_bruto if lanc.valor_bruto is not None else lanc.valor
        taxa = lanc.valor_taxa if lanc.valor_taxa is not None else 0.0
        lanc.valor_liquido = bruto - taxa

    await session.flush()
    await session.refresh(lanc)
    await log_event(
        session,
        acao="financeiro.updated",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="lancamento",
        entidade_id=str(lanc.id),
        dados={"campos": sorted(campos.keys()), "status": lanc.status.value},
    )
    return lanc


@router.delete("/{id}", status_code=204)
async def deletar_lancamento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    lanc = await get_lancamento_do_estudio(
        session,
        lancamento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Lançamento não encontrado",
    )
    lanc_id = str(lanc.id)
    lanc_meta = {"tipo": lanc.tipo.value, "valor": float(lanc.valor)}
    await session.delete(lanc)
    await log_event(
        session,
        acao="financeiro.deleted",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="lancamento",
        entidade_id=lanc_id,
        dados=lanc_meta,
    )
    return None


@router.post("/comissoes/gerar", response_model=LancamentoResponse, status_code=201)
async def gerar_comissao(
    req: ComissaoGerarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    await get_usuario_do_estudio(
        session,
        usuario_id=req.artista_id,
        estudio_id=usuario.estudio_id,
        active_only=True,
        not_found_status=status.HTTP_400_BAD_REQUEST,
        detail="Artista inválido ou não pertence ao seu estúdio",
    )

    await get_atendimento_do_estudio(
        session,
        atendimento_id=req.atendimento_id,
        estudio_id=usuario.estudio_id,
        active_only=True,
        not_found_status=status.HTTP_400_BAD_REQUEST,
        detail="Atendimento inválido ou não pertence ao seu estúdio",
    )

    valor_comissao = req.valor_servico * (req.comissao_percentual / 100.0)

    lanc = Lancamento(
        estudio_id=usuario.estudio_id,
        tipo=TipoLancamento.COMISSAO,
        descricao=req.descricao or f"Comissão de {req.comissao_percentual}% sobre serviço de atendimento",
        valor=valor_comissao,
        status=StatusLancamento.PENDENTE,
        artista_id=req.artista_id,
        atendimento_id=req.atendimento_id,
        origem=OrigemLancamento.COMISSAO,
        categoria="COMISSAO_ARTISTA",
        centro_custo="ARTISTA",
        comissao_percentual=req.comissao_percentual,
        competencia=datetime.now(UTC).date(),
        data_vencimento=datetime.now(UTC),
        valor_bruto=valor_comissao,
        valor_taxa=0.0,
        valor_liquido=valor_comissao,
        criado_por_id=usuario.id,
    )
    session.add(lanc)
    await session.flush()
    await session.refresh(lanc)
    return lanc


@router.patch("/comissoes/{id}/pagar", response_model=LancamentoResponse)
async def pagar_comissao(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    lanc = await get_lancamento_do_estudio(
        session,
        lancamento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Comissão não encontrada",
    )

    if lanc.tipo != TipoLancamento.COMISSAO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este lançamento não é uma comissão",
        )

    lanc.status = StatusLancamento.PAGO
    lanc.data_realizada = datetime.now(UTC)

    await session.flush()
    await session.refresh(lanc)
    return lanc


@router.get("/exportar")
async def exportar_financeiro(
    tipo: TipoLancamento | None = Query(None),
    status: StatusLancamento | None = Query(None),
    data_inicio: date | None = Query(None),
    data_fim: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    query = select(Lancamento).where(Lancamento.estudio_id == usuario.estudio_id)

    if tipo:
        query = query.where(Lancamento.tipo == tipo)
    if status:
        query = query.where(Lancamento.status == status)

    if data_inicio or data_fim:
        data_col = func.coalesce(
            Lancamento.competencia,
            cast(Lancamento.data_realizada, Date),
            cast(Lancamento.data_prevista, Date),
        )
        if data_inicio:
            query = query.where(data_col >= data_inicio)
        if data_fim:
            query = query.where(data_col <= data_fim)

    query = query.order_by(Lancamento.criado_em.desc())
    result = await session.execute(query)
    lancamentos = result.scalars().all()

    await log_event(
        session,
        acao="financeiro.exported",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="financeiro",
        dados={
            "total": len(lancamentos),
            "tipo": tipo.value if tipo else None,
            "status": status.value if status else None,
        },
        commit=True,
    )

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", lineterminator="\n")

    writer.writerow([
        "ID", "Data Competência", "Vencimento", "Data Realização", "Tipo",
        "Categoria", "Descrição", "Valor Bruto (R$)", "Taxa (R$)", "Valor Líquido (R$)",
        "Forma Pagamento", "Status", "Origem"
    ])

    for lanc in lancamentos:
        comp_str = lanc.competencia.strftime("%d/%m/%Y") if lanc.competencia else ""
        venc_str = lanc.data_vencimento.strftime("%d/%m/%Y %H:%M") if lanc.data_vencimento else ""
        real_str = lanc.data_realizada.strftime("%d/%m/%Y %H:%M") if lanc.data_realizada else ""

        writer.writerow([
            str(lanc.id),
            comp_str,
            venc_str,
            real_str,
            lanc.tipo.value,
            lanc.categoria or "",
            lanc.descricao or "",
            f"{lanc.valor_bruto:.2f}" if lanc.valor_bruto is not None else f"{lanc.valor:.2f}",
            f"{lanc.valor_taxa:.2f}" if lanc.valor_taxa is not None else "0.00",
            f"{lanc.valor_liquido:.2f}" if lanc.valor_liquido is not None else f"{lanc.valor:.2f}",
            lanc.forma_pagamento.value if lanc.forma_pagamento else "",
            lanc.status.value,
            lanc.origem.value
        ])

    output.seek(0)

    filename = f"financeiro_sessaoink_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
        "Content-Type": "text/csv; charset=utf-8"
    }

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        headers=headers
    )
