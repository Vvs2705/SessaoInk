"""Helpers para consultas escopadas ao estudio do usuario autenticado."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.atendimento import Atendimento
from app.models.cliente import Cliente
from app.models.documento import Documento
from app.models.financeiro import Lancamento
from app.models.usuario import Usuario


async def get_cliente_do_estudio(
    session: AsyncSession,
    *,
    cliente_id: uuid.UUID,
    estudio_id: uuid.UUID,
    active_only: bool = False,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
    detail: str = "Cliente não encontrado",
) -> Cliente:
    q = select(Cliente).where(Cliente.id == cliente_id, Cliente.estudio_id == estudio_id)
    if active_only:
        q = q.where(Cliente.ativo)
    cliente = await session.scalar(q)
    if not cliente:
        raise HTTPException(status_code=not_found_status, detail=detail)
    return cliente


async def get_atendimento_do_estudio(
    session: AsyncSession,
    *,
    atendimento_id: uuid.UUID,
    estudio_id: uuid.UUID,
    active_only: bool = False,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
    detail: str = "Atendimento não encontrado",
) -> Atendimento:
    q = select(Atendimento).where(
        Atendimento.id == atendimento_id,
        Atendimento.estudio_id == estudio_id,
    )
    if active_only:
        q = q.where(Atendimento.ativo)
    atendimento = await session.scalar(q)
    if not atendimento:
        raise HTTPException(status_code=not_found_status, detail=detail)
    return atendimento


async def get_documento_do_estudio(
    session: AsyncSession,
    *,
    documento_id: uuid.UUID,
    estudio_id: uuid.UUID,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
    detail: str = "Documento não encontrado",
) -> Documento:
    documento = await session.scalar(
        select(Documento).where(
            Documento.id == documento_id,
            Documento.estudio_id == estudio_id,
        )
    )
    if not documento:
        raise HTTPException(status_code=not_found_status, detail=detail)
    return documento


async def get_lancamento_do_estudio(
    session: AsyncSession,
    *,
    lancamento_id: uuid.UUID,
    estudio_id: uuid.UUID,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
    detail: str = "Lançamento não encontrado",
) -> Lancamento:
    lancamento = await session.scalar(
        select(Lancamento).where(
            Lancamento.id == lancamento_id,
            Lancamento.estudio_id == estudio_id,
        )
    )
    if not lancamento:
        raise HTTPException(status_code=not_found_status, detail=detail)
    return lancamento


async def get_usuario_do_estudio(
    session: AsyncSession,
    *,
    usuario_id: uuid.UUID,
    estudio_id: uuid.UUID,
    active_only: bool = False,
    not_found_status: int = status.HTTP_404_NOT_FOUND,
    detail: str = "Usuário não encontrado",
) -> Usuario:
    q = select(Usuario).where(Usuario.id == usuario_id, Usuario.estudio_id == estudio_id)
    if active_only:
        q = q.where(Usuario.ativo)
    usuario = await session.scalar(q)
    if not usuario:
        raise HTTPException(status_code=not_found_status, detail=detail)
    return usuario
