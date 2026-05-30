"""Router de Financeiro."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.financeiro import Lancamento, TipoLancamento, StatusLancamento, FormaPagamentoFin
from app.models.usuario import Usuario

router = APIRouter(prefix="/financeiro", tags=["financeiro"])


class LancamentoCreate(BaseModel):
    tipo: TipoLancamento
    descricao: Optional[str] = None
    valor: float
    status: Optional[StatusLancamento] = None
    forma_pagamento: Optional[FormaPagamentoFin] = None
    data_prevista: Optional[datetime] = None
    atendimento_id: Optional[uuid.UUID] = None
    artista_id: Optional[uuid.UUID] = None


class LancamentoResponse(BaseModel):
    id: uuid.UUID
    tipo: TipoLancamento
    descricao: Optional[str]
    valor: float
    status: StatusLancamento
    forma_pagamento: Optional[FormaPagamentoFin]
    data_prevista: Optional[datetime]
    data_realizada: Optional[datetime]
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
    usuario: Usuario = Depends(get_usuario_atual),
):
    from datetime import timezone
    status_val = dados.status or StatusLancamento.PENDENTE
    data_realizada = None
    if status_val == StatusLancamento.PAGO:
        data_realizada = datetime.now(timezone.utc)

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
    from datetime import timezone
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # 1. Receita do mês (ENTRADA e SINAL pagos neste mês)
    receita_res = await session.execute(
        select(func.sum(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL]),
            Lancamento.status == StatusLancamento.PAGO,
            Lancamento.data_realizada >= start_of_month
        )
    )
    receita = float(receita_res.scalar() or 0)

    # 2. Sinais pendentes (SINAL pendente)
    sinais_res = await session.execute(
        select(func.sum(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo == TipoLancamento.SINAL,
            Lancamento.status == StatusLancamento.PENDENTE
        )
    )
    sinais = float(sinais_res.scalar() or 0)

    # 3. Ticket médio (média de ENTRADA e SINAL pagos)
    ticket_res = await session.execute(
        select(func.avg(Lancamento.valor)).where(
            Lancamento.estudio_id == usuario.estudio_id,
            Lancamento.tipo.in_([TipoLancamento.ENTRADA, TipoLancamento.SINAL]),
            Lancamento.status == StatusLancamento.PAGO
        )
    )
    ticket = float(ticket_res.scalar() or 0)

    return ResumoResponse(receita_mes=receita, sinais_pendentes=sinais, ticket_medio=ticket)
