"""Router de Atendimentos."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.usuario import Usuario
from app.schemas.atendimento import (
    AtendimentoCreate, AtendimentoResponse,
    AtendimentoStatusUpdate, AtendimentoUpdate,
)

router = APIRouter(prefix="/atendimentos", tags=["atendimentos"])


@router.get("/", response_model=list[AtendimentoResponse])
async def listar_atendimentos(
    status_op: StatusOperacional | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    q = select(Atendimento).where(
        Atendimento.estudio_id == usuario.estudio_id,
        Atendimento.ativo == True,
    )
    if status_op:
        q = q.where(Atendimento.status_operacional == status_op)
    q = q.order_by(Atendimento.criado_em.desc())
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/", response_model=AtendimentoResponse, status_code=status.HTTP_201_CREATED)
async def criar_atendimento(
    dados: AtendimentoCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    atendimento = Atendimento(
        estudio_id=usuario.estudio_id,
        **dados.model_dump()
    )
    session.add(atendimento)
    await session.flush()
    await session.refresh(atendimento)
    return atendimento


@router.get("/{id}", response_model=AtendimentoResponse)
async def obter_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id,
            Atendimento.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Atendimento não encontrado")
    return item


@router.patch("/{id}", response_model=AtendimentoResponse)
async def atualizar_atendimento(
    id: uuid.UUID,
    dados: AtendimentoUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id, Atendimento.estudio_id == usuario.estudio_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Atendimento não encontrado")
    for k, v in dados.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await session.flush()
    await session.refresh(item)
    return item


@router.patch("/{id}/status", response_model=AtendimentoResponse)
async def alterar_status(
    id: uuid.UUID,
    dados: AtendimentoStatusUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id, Atendimento.estudio_id == usuario.estudio_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Atendimento não encontrado")
    if dados.status_operacional:
        item.status_operacional = dados.status_operacional
    if dados.status_financeiro:
        item.status_financeiro = dados.status_financeiro
    await session.flush()
    await session.refresh(item)
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id, Atendimento.estudio_id == usuario.estudio_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Atendimento não encontrado")
    item.ativo = False
