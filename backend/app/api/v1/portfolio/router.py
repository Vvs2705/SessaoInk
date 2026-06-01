"""Router de Portfolio - upload seguro de imagens."""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.config import settings
from app.core.database import get_session
from app.core.upload_security import processar_upload
from app.models.portfolio import Portfolio, VisibilidadePortfolio
from app.models.usuario import TipoUsuario, Usuario

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PortfolioResponse(BaseModel):
    id: uuid.UUID
    imagem_path: str
    titulo: str | None
    estilo: str | None
    parte_corpo: str | None
    visibilidade: VisibilidadePortfolio
    autorizado_publicacao: bool
    ativo: bool
    model_config = {"from_attributes": True}


def _portfolio_visivel_para_usuario(item: Portfolio, usuario: Usuario) -> bool:
    if usuario.tipo != TipoUsuario.ARTISTA:
        return True
    return item.artista_id == usuario.id


@router.get("/", response_model=list[PortfolioResponse])
async def listar_portfolio(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    filtros = [
        Portfolio.estudio_id == usuario.estudio_id,
        Portfolio.ativo,
    ]
    if usuario.tipo == TipoUsuario.ARTISTA:
        filtros.append(Portfolio.artista_id == usuario.id)

    result = await session.execute(
        select(Portfolio).where(*filtros).order_by(Portfolio.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/upload", response_model=PortfolioResponse, status_code=201)
async def upload_foto(
    arquivo: UploadFile = File(...),
    titulo: str | None = Form(None),
    estilo: str | None = Form(None),
    parte_corpo: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Upload de foto do portfolio pelo pipeline seguro compartilhado."""
    nome_arquivo, _imagem = await processar_upload(
        arquivo, str(usuario.estudio_id), "portfolio"
    )

    item = Portfolio(
        estudio_id=usuario.estudio_id,
        artista_id=usuario.id,
        imagem_path=nome_arquivo,
        titulo=titulo,
        estilo=estilo,
        parte_corpo=parte_corpo,
        visibilidade=VisibilidadePortfolio.PRIVADO,
        autorizado_publicacao=False,
    )
    session.add(item)
    await session.flush()
    await session.refresh(item)
    return item


@router.get("/{id}/imagem")
async def servir_imagem(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Serve imagem autenticada sem expor o caminho real."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id,
            Portfolio.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item or not _portfolio_visivel_para_usuario(item, usuario):
        raise HTTPException(404, "Imagem nao encontrada")

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(item.estudio_id)
        / "portfolio"
        / item.imagem_path
    )
    if not caminho.exists():
        raise HTTPException(404, "Arquivo nao encontrado")

    return FileResponse(str(caminho))


@router.delete("/{id}", status_code=204)
async def arquivar_portfolio(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Soft delete - oculta a foto."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id,
            Portfolio.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item or not _portfolio_visivel_para_usuario(item, usuario):
        raise HTTPException(404, "Item nao encontrado")
    item.ativo = False
    await session.flush()
    return None


@router.patch("/{id}/visibilidade", response_model=PortfolioResponse)
async def alterar_visibilidade(
    id: uuid.UUID,
    visibilidade: VisibilidadePortfolio,
    autorizado: bool = False,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Publica ou torna privada uma imagem."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id,
            Portfolio.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item or not _portfolio_visivel_para_usuario(item, usuario):
        raise HTTPException(404, "Item nao encontrado")

    if visibilidade == VisibilidadePortfolio.PUBLICO and not autorizado:
        raise HTTPException(400, "E necessario confirmar autorizacao para publicar")

    item.visibilidade = visibilidade
    if autorizado:
        item.autorizado_publicacao = True
    await session.flush()
    await session.refresh(item)
    return item
