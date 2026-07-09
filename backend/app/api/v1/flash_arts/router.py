"""Router de Flash Arts."""

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import exigir_assinatura_ativa, get_usuario_atual
from app.core.database import get_session
from app.core.storage import montar_key, resposta_imagem
from app.core.upload_security import processar_upload
from app.models.portfolio import FlashArt, StatusFlash
from app.models.usuario import TipoUsuario, Usuario

# Enforcement de assinatura: todo o módulo exige trial vigente ou assinatura
# ativa (402 caso contrário) — rotas de pagamento/config/LGPD ficam isentas.
router = APIRouter(
    prefix="/flash-arts",
    tags=["flash-arts"],
    dependencies=[Depends(exigir_assinatura_ativa)],
)


class FlashArtResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    titulo: str
    descricao: str | None
    imagem_path: str | None
    preco: float | None
    tamanho_sugerido: str | None
    local_recomendado: str | None
    status: StatusFlash
    ativo: bool
    model_config = {"from_attributes": True}


def _flash_visivel_para_usuario(item: FlashArt, usuario: Usuario) -> bool:
    if usuario.tipo != TipoUsuario.ARTISTA:
        return True
    return item.artista_id == usuario.id


@router.get("/", response_model=list[FlashArtResponse])
async def listar_flash_arts(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    filtros = [
        FlashArt.estudio_id == usuario.estudio_id,
        FlashArt.ativo,
    ]
    if usuario.tipo == TipoUsuario.ARTISTA:
        filtros.append(FlashArt.artista_id == usuario.id)

    result = await session.execute(
        select(FlashArt).where(*filtros).order_by(FlashArt.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=FlashArtResponse, status_code=201)
async def criar_flash_art(
    arquivo: UploadFile = File(...),
    titulo: str = Form(...),
    descricao: str | None = Form(None),
    preco: float | None = Form(None),
    tamanho_sugerido: str | None = Form(None),
    local_recomendado: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    nome_arquivo, _imagem = await processar_upload(
        arquivo, str(usuario.estudio_id), "flash_arts"
    )

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
    if not item or not _flash_visivel_para_usuario(item, usuario):
        raise HTTPException(404, "Flash art nao encontrada")

    if not item.imagem_path:
        raise HTTPException(404, "Imagem nao cadastrada para esta flash art")

    key = montar_key(str(item.estudio_id), "flash_arts", item.imagem_path)
    return await resposta_imagem(key)


@router.patch("/{id}/status", response_model=FlashArtResponse)
async def alterar_status_flash(
    id: uuid.UUID,
    status_novo: StatusFlash,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(FlashArt).where(
            FlashArt.id == id,
            FlashArt.estudio_id == usuario.estudio_id,
        )
    )
    flash = result.scalar_one_or_none()
    if not flash or not _flash_visivel_para_usuario(flash, usuario):
        raise HTTPException(404, "Flash art nao encontrada")
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
        select(FlashArt).where(
            FlashArt.id == id,
            FlashArt.estudio_id == usuario.estudio_id,
        )
    )
    flash = result.scalar_one_or_none()
    if not flash or not _flash_visivel_para_usuario(flash, usuario):
        raise HTTPException(404, "Flash art nao encontrada")
    flash.ativo = False
    await session.flush()
    return None
