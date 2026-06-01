"""Router de Financeiro."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual, require_role
from app.core.database import get_session
from app.models.financeiro import (
    FormaPagamentoFin,
    Lancamento,
    StatusLancamento,
    TipoLancamento,
)
from app.models.usuario import TipoUsuario, Usuario
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_lancamento_do_estudio,
    get_usuario_do_estudio,
)

router = APIRouter(prefix="/financeiro", tags=["financeiro"])


class LancamentoCreate(BaseModel):
    tipo: TipoLancamento
    descricao: str | None = None
    valor: float
    status: StatusLancamento | None = None
    forma_pagamento: FormaPagamentoFin | None = None
    data_prevista: datetime | None = None
    atendimento_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None


class LancamentoUpdate(BaseModel):
    tipo: TipoLancamento | None = None
    descricao: str | None = None
    valor: float | None = None
    status: StatusLancamento | None = None
    forma_pagamento: FormaPagamentoFin | None = None
    data_prevista: datetime | None = None
    atendimento_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None


class LancamentoResponse(BaseModel):
    id: uuid.UUID
    tipo: TipoLancamento
    descricao: str | None
    valor: float
    status: StatusLancamento
    forma_pagamento: FormaPagamentoFin | None
    data_prevista: datetime | None
    data_realizada: datetime | None
    model_config = {"from_attributes": True}


class ResumoResponse(BaseModel):
    receita_mes: float
    sinais_pendentes: float
    ticket_medio: float


@router.get("/", response_model=list[LancamentoResponse])
async def listar_lancamentos(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Lancamento).where(
            Lancamento.estudio_id == usuario.estudio_id,
        ).order_by(Lancamento.criado_em.desc())
    )
    return result.scalars().all()


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
    )
    session.add(lanc)
    await session.flush()
    await session.refresh(lanc)
    return lanc


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
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL]),
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.data_realizada >= start_of_month,
        )
    )
    receita = float(receita_res.scalar() or 0)

    sinais_res = await session.execute(
        select(func.sum(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo == TipoLancamento.SINAL,
            Lancamento.status == StatusLancamento.PENDENTE,
        )
    )
    sinais = float(sinais_res.scalar() or 0)

    ticket_res = await session.execute(
        select(func.avg(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL]),
            Lancamento.status == StatusLancamento.PAGO,
        )
    )
    ticket = float(ticket_res.scalar() or 0)

    return ResumoResponse(
        receita_mes=receita,
        sinais_pendentes=sinais,
        ticket_medio=ticket,
    )


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
        if campos["status"] == StatusLancamento.PAGO and lanc.status != StatusLancamento.PAGO:
            lanc.data_realizada = datetime.now(UTC)
        elif campos["status"] != StatusLancamento.PAGO and lanc.status == StatusLancamento.PAGO:
            lanc.data_realizada = None

    for campo, valor in campos.items():
        setattr(lanc, campo, valor)

    await session.flush()
    await session.refresh(lanc)
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
    await session.delete(lanc)
    return None
