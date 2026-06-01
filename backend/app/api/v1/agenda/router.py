"""Router de Agenda: sessoes por periodo e agendamento."""

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.usuario import Usuario
from app.services.tenant import get_atendimento_do_estudio

router = APIRouter(prefix="/agenda", tags=["agenda"])


class SessaoResponse(BaseModel):
    id: uuid.UUID
    data_sessao: datetime
    duracao_minutos: int | None
    tipo: str
    status_operacional: str
    descricao: str | None
    estilo: str | None
    parte_corpo: str | None
    valor_total: float | None
    cliente_id: uuid.UUID | None

    model_config = {"from_attributes": True}


class AgendaMesResponse(BaseModel):
    ano: int
    mes: int
    total_sessoes: int
    sessoes: list[SessaoResponse]
    dias_com_sessao: list[int]


class AgendarSessaoRequest(BaseModel):
    atendimento_id: uuid.UUID
    data_sessao: datetime
    duracao_minutos: int | None = 120


@router.get("/", response_model=AgendaMesResponse)
async def listar_agenda(
    ano: int = Query(default=None, ge=2020, le=2035),
    mes: int = Query(default=None, ge=1, le=12),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    hoje = date.today()
    ano = ano or hoje.year
    mes = mes or hoje.month

    result = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo,
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
    atendimento = await get_atendimento_do_estudio(
        session,
        atendimento_id=dados.atendimento_id,
        estudio_id=usuario.estudio_id,
        active_only=True,
        detail="Atendimento não encontrado",
    )

    if atendimento.artista_id:
        duracao_min = dados.duracao_minutos or 120

        def _naive(dt: datetime) -> datetime:
            if dt.tzinfo is not None:
                dt = dt.astimezone(UTC).replace(tzinfo=None)
            return dt

        inicio_prop = _naive(dados.data_sessao)
        fim_prop = inicio_prop + timedelta(minutes=duracao_min)

        conflito_result = await session.execute(
            select(Atendimento).where(
                Atendimento.artista_id == atendimento.artista_id,
                Atendimento.estudio_id == usuario.estudio_id,
                Atendimento.ativo,
                Atendimento.id != atendimento.id,
                Atendimento.data_sessao.isnot(None),
                Atendimento.status_operacional.in_([
                    StatusOperacional.CONFIRMADO,
                    StatusOperacional.EM_ATENDIMENTO,
                ]),
            )
        )
        for outro in conflito_result.scalars().all():
            outro_duracao = outro.duracao_minutos or 120
            outro_inicio = _naive(outro.data_sessao)
            outro_fim = outro_inicio + timedelta(minutes=outro_duracao)
            if outro_inicio < fim_prop and outro_fim > inicio_prop:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Conflito de horário: o artista já possui uma sessão "
                        "agendada neste período."
                    ),
                )

    atendimento.data_sessao = dados.data_sessao
    atendimento.duracao_minutos = dados.duracao_minutos

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
    agora = datetime.now(UTC)
    limite = agora + timedelta(days=dias)

    result = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == usuario.estudio_id,
            Atendimento.ativo,
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
