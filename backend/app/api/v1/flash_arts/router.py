"""Router de Flash Arts."""

import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.config import settings
from app.core.database import get_session
from app.models.portfolio import FlashArt, StatusFlash
from app.models.usuario import Usuario

router = APIRouter(prefix="/flash-arts", tags=["flash-arts"])

# Tipos MIME permitidos e seus magic bytes
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024  # 15MB


def detectar_extensao(conteudo: bytes) -> str:
    """Detecta extensão pelo magic bytes. Retorna None se não reconhecido."""
    if conteudo[:3] == b"\xff\xd8\xff":
        return "jpg"
    if conteudo[:4] == b"\x89PNG":
        return "png"
    if b"WEBP" in conteudo[0:12]:
        return "webp"
    return ""


class FlashArtResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    titulo: str
    descricao: Optional[str]
    imagem_path: Optional[str]
    preco: Optional[float]
    tamanho_sugerido: Optional[str]
    local_recomendado: Optional[str]
    status: StatusFlash
    ativo: bool
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[FlashArtResponse])
async def listar_flash_arts(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(FlashArt).where(
            FlashArt.estudio_id == usuario.estudio_id,
            FlashArt.ativo == True,
        ).order_by(FlashArt.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=FlashArtResponse, status_code=201)
async def criar_flash_art(
    arquivo: UploadFile = File(...),
    titulo: str = Form(...),
    descricao: Optional[str] = Form(None),
    preco: Optional[float] = Form(None),
    tamanho_sugerido: Optional[str] = Form(None),
    local_recomendado: Optional[str] = Form(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    # 1. Verificar MIME
    if arquivo.content_type not in ALLOWED_MIME:
        raise HTTPException(415, f"Tipo não permitido: {arquivo.content_type}")

    # 2. Verificar tamanho
    conteudo = await arquivo.read(MAX_SIZE + 1)
    if len(conteudo) > MAX_SIZE:
        raise HTTPException(413, f"Arquivo muito grande (máx {settings.UPLOAD_MAX_SIZE_MB}MB)")

    # 3. Magic bytes
    ext = detectar_extensao(conteudo)
    if not ext:
        raise HTTPException(415, "Formato de imagem não reconhecido")

    # 4. Salvar com UUID no path seguro
    nome_arquivo = f"{uuid.uuid4()}.{ext}"
    dir_upload = Path(settings.STORAGE_PATH) / "uploads" / str(usuario.estudio_id) / "flash_arts"
    dir_upload.mkdir(parents=True, exist_ok=True)
    caminho = dir_upload / nome_arquivo

    with open(caminho, "wb") as f:
        f.write(conteudo)

    # 5. Criar registro no banco
    flash = FlashArt(
        estudio_id=usuario.estudio_id,
        artista_id=usuario.id,
        titulo=titulo,
        descricao=descricao,
        imagem_path=nome_arquivo,
        preco=preco,
        tamanho_sugerido=tamanho_sugerido,
        local_recomendado=local_recomendado,
        status=StatusFlash.DISPONIVEL,
    )
    session.add(flash)
    await session.flush()
    await session.refresh(flash)
    return flash


@router.get("/{id}/imagem")
async def servir_imagem(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Serve imagem autenticada da flash art."""
    result = await session.execute(
        select(FlashArt).where(
            FlashArt.id == id,
            FlashArt.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Flash art não encontrada")

    if not item.imagem_path:
        raise HTTPException(404, "Imagem não cadastrada para esta flash art")

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(item.estudio_id)
        / "flash_arts"
        / item.imagem_path
    )
    if not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado")

    return FileResponse(str(caminho))


@router.patch("/{id}/status", response_model=FlashArtResponse)
async def alterar_status_flash(
    id: uuid.UUID,
    status_novo: StatusFlash,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(FlashArt).where(FlashArt.id == id, FlashArt.estudio_id == usuario.estudio_id)
    )
    flash = result.scalar_one_or_none()
    if not flash:
        raise HTTPException(404, "Flash art não encontrada")
    flash.status = status_novo
    await session.flush()
    await session.refresh(flash)
    return flash


@router.delete("/{id}", status_code=204)
async def arquivar_flash_art(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(FlashArt).where(FlashArt.id == id, FlashArt.estudio_id == usuario.estudio_id)
    )
    flash = result.scalar_one_or_none()
    if not flash:
        raise HTTPException(404, "Flash art não encontrada")
    flash.ativo = False
    await session.flush()
    return None

