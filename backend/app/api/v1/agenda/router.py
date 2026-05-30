"""Router de Agenda — sessões por período e agendamento."""

import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, extract, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusOperacional, TipoAtendimento
from app.models.usuario import Usuario

router = APIRouter(prefix="/agenda", tags=["agenda"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SessaoResponse(BaseModel):
    id: uuid.UUID
    data_sessao: datetime
    duracao_minutos: Optional[int]
    tipo: str
    status_operacional: str
    descricao: Optional[str]
    estilo: Optional[str]
    parte_corpo: Optional[str]
    valor_total: Optional[float]
    cliente_id: Optional[uuid.UUID]

    model_config = {"from_attributes": True}


class AgendaMesResponse(BaseModel):
    ano: int
    mes: int
    total_sessoes: int
    sessoes: list[SessaoResponse]
    dias_com_sessao: list[int]  # lista de dias do mês com pelo menos 1 sessão


class AgendarSessaoRequest(BaseModel):
    atendimento_id: uuid.UUID
    data_sessao: datetime
    duracao_minutos: Optional[int] = 120


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=AgendaMesResponse)
async def listar_agenda(
    ano: int = Query(default=None, ge=2020, le=2035),
    mes: int = Query(default=None, ge=1, le=12),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Lista todas as sessões agendadas (data_sessao preenchida) para o mês/ano indicado.

    Se não informado, usa o mês atual.
    """
    hoje = date.today()
    ano = ano or hoje.year
    mes = mes or hoje.month

    result = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo == True,
            Atendimento.data_sessao.isnot(None),
            extract("year", Atendimento.data_sessao) == ano,
            extract("month", Atendimento.data_sessao) == mes,
        )
        .order_by(Atendimento.data_sessao)
    )
    sessoes = result.scalars().all()

    dias_com_sessao = sorted(
        {s.data_sessao.day for s in sessoes if s.data_sessao}
    )

    return AgendaMesResponse(
        ano=ano,
        mes=mes,
        total_sessoes=len(sessoes),
        sessoes=[
            SessaoResponse(
                id=s.id,
                data_sessao=s.data_sessao,
                duracao_minutos=s.duracao_minutos,
                tipo=s.tipo.value,
                status_operacional=s.status_operacional.value,
                descricao=s.descricao,
                estilo=s.estilo,
                parte_corpo=s.parte_corpo,
                valor_total=float(s.valor_total) if s.valor_total else None,
                cliente_id=s.cliente_id,
            )
            for s in sessoes
        ],
        dias_com_sessao=dias_com_sessao,
    )


@router.post("/agendar", response_model=SessaoResponse, status_code=status.HTTP_200_OK)
async def agendar_sessao(
    dados: AgendarSessaoRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Agenda (ou reagenda) uma sessão vinculada a um atendimento existente."""
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == dados.atendimento_id,
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo == True,
        )
    )
    atendimento = result.scalar_one_or_none()
    if not atendimento:
        raise HTTPException(status_code=404, detail="Atendimento não encontrado")

    atendimento.data_sessao = dados.data_sessao
    atendimento.duracao_minutos = dados.duracao_minutos

    # Se estava SOLICITADO ou EM_ANALISE, avança para CONFIRMADO ao agendar
    if atendimento.status_operacional in (
        StatusOperacional.SOLICITADO,
        StatusOperacional.EM_ANALISE,
    ):
        atendimento.status_operacional = StatusOperacional.CONFIRMADO

    await session.commit()
    await session.refresh(atendimento)

    return SessaoResponse(
        id=atendimento.id,
        data_sessao=atendimento.data_sessao,
        duracao_minutos=atendimento.duracao_minutos,
        tipo=atendimento.tipo.value,
        status_operacional=atendimento.status_operacional.value,
        descricao=atendimento.descricao,
        estilo=atendimento.estilo,
        parte_corpo=atendimento.parte_corpo,
        valor_total=float(atendimento.valor_total) if atendimento.valor_total else None,
        cliente_id=atendimento.cliente_id,
    )


@router.get("/proximas", response_model=list[SessaoResponse])
async def proximas_sessoes(
    dias: int = Query(default=7, ge=1, le=30),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Lista as próximas sessões nos próximos N dias (padrão: 7)."""
    agora = datetime.now(timezone.utc)
    limite = agora + timedelta(days=dias)

    result = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo == True,
            Atendimento.data_sessao >= agora,
            Atendimento.data_sessao <= limite,
        )
        .order_by(Atendimento.data_sessao)
    )
    sessoes = result.scalars().all()

    return [
        SessaoResponse(
            id=s.id,
            data_sessao=s.data_sessao,
            duracao_minutos=s.duracao_minutos,
            tipo=s.tipo.value,
            status_operacional=s.status_operacional.value,
            descricao=s.descricao,
            estilo=s.estilo,
            parte_corpo=s.parte_corpo,
            valor_total=float(s.valor_total) if s.valor_total else None,
            cliente_id=s.cliente_id,
        )
        for s in sessoes
    ]
