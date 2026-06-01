"""Router de Atendimentos."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.config import settings
from app.core.database import get_session
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.usuario import Usuario
from app.schemas.atendimento import (
    AtendimentoCreate,
    AtendimentoResponse,
    AtendimentoStatusUpdate,
    AtendimentoUpdate,
)
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_cliente_do_estudio,
    get_usuario_do_estudio,
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
        Atendimento.ativo,
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
    if dados.cliente_id:
        await get_cliente_do_estudio(
            session,
            cliente_id=dados.cliente_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Cliente inválido ou não pertence ao seu estúdio",
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

    atendimento = Atendimento(estudio_id=usuario.estudio_id, **dados.model_dump())
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
    return await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )


@router.patch("/{id}", response_model=AtendimentoResponse)
async def atualizar_atendimento(
    id: uuid.UUID,
    dados: AtendimentoUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )

    if dados.cliente_id is not None:
        await get_cliente_do_estudio(
            session,
            cliente_id=dados.cliente_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Cliente inválido ou não pertence ao seu estúdio",
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
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
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
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
    item.ativo = False


@router.get("/{id}/imagens", response_model=list[str])
async def listar_imagens_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )

    dir_imagens = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(usuario.estudio_id)
        / "atendimentos"
        / str(id)
    )

    if not dir_imagens.exists() or not dir_imagens.is_dir():
        return []

    exts = {".jpg", ".jpeg", ".png", ".webp"}
    return [
        f.name for f in dir_imagens.iterdir()
        if f.is_file() and f.suffix.lower() in exts
    ]


@router.get("/{id}/imagens/{filename}")
async def obter_imagem_atendimento(
    id: uuid.UUID,
    filename: str,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(usuario.estudio_id)
        / "atendimentos"
        / str(id)
        / filename
    )

    if not caminho.exists() or not caminho.is_file():
        raise HTTPException(404, "Imagem não encontrada no disco")

    return FileResponse(str(caminho))
