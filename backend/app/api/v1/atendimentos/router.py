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
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.schemas.atendimento import (
    AtendimentoCreate,
    AtendimentoResponse,
    AtendimentoStatusUpdate,
    AtendimentoUpdate,
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
    # Validar se o cliente informado pertence ao mesmo estúdio do usuário
    if dados.cliente_id:
        cliente_exists = await session.scalar(
            select(Cliente).where(
                Cliente.id == dados.cliente_id,
                Cliente.estudio_id == usuario.estudio_id,
                Cliente.ativo,
            )
        )
        if not cliente_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cliente inválido ou não pertence ao seu estúdio",
            )

    # Validar se o artista informado pertence ao mesmo estúdio do usuário
    if dados.artista_id:
        artista_exists = await session.scalar(
            select(Usuario).where(
                Usuario.id == dados.artista_id,
                Usuario.estudio_id == usuario.estudio_id,
                Usuario.ativo,
            )
        )
        if not artista_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Artista inválido ou não pertence ao seu estúdio",
            )

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

    # Validar se o cliente informado pertence ao mesmo estúdio do usuário
    if dados.cliente_id is not None:
        cliente_exists = await session.scalar(
            select(Cliente).where(
                Cliente.id == dados.cliente_id,
                Cliente.estudio_id == usuario.estudio_id,
                Cliente.ativo,
            )
        )
        if not cliente_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cliente inválido ou não pertence ao seu estúdio",
            )

    # Validar se o artista informado pertence ao mesmo estúdio do usuário
    if dados.artista_id is not None:
        artista_exists = await session.scalar(
            select(Usuario).where(
                Usuario.id == dados.artista_id,
                Usuario.estudio_id == usuario.estudio_id,
                Usuario.ativo,
            )
        )
        if not artista_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
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


@router.get("/{id}/imagens", response_model=list[str])
async def listar_imagens_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    # Validar se o atendimento existe e pertence ao estúdio do usuário
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id,
            Atendimento.estudio_id == usuario.estudio_id,
        )
    )
    atendimento = result.scalar_one_or_none()
    if not atendimento:
        raise HTTPException(404, "Atendimento não encontrado")

    # Localizar diretório no disco
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
    filenames = [
        f.name for f in dir_imagens.iterdir()
        if f.is_file() and f.suffix.lower() in exts
    ]
    return filenames


@router.get("/{id}/imagens/{filename}")
async def obter_imagem_atendimento(
    id: uuid.UUID,
    filename: str,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    # Validar se o atendimento existe e pertence ao estúdio do usuário
    result = await session.execute(
        select(Atendimento).where(
            Atendimento.id == id,
            Atendimento.estudio_id == usuario.estudio_id,
        )
    )
    atendimento = result.scalar_one_or_none()
    if not atendimento:
        raise HTTPException(404, "Atendimento não encontrado")

    # Localizar arquivo no disco
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
