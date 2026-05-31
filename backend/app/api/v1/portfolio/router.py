"""Router de Portfólio — upload seguro de imagens."""

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
from app.models.portfolio import Portfolio, VisibilidadePortfolio
from app.models.usuario import Usuario

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# Tipos MIME permitidos e seus magic bytes
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAGIC = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG": "png",
}
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


@router.get("/", response_model=list[PortfolioResponse])
async def listar_portfolio(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.estudio_id == usuario.estudio_id,
            Portfolio.ativo,
        ).order_by(Portfolio.criado_em.desc())
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
    """Upload de foto do portfólio com validação de tipo e tamanho."""
    # 1. Verificar MIME declarado
    if arquivo.content_type not in ALLOWED_MIME:
        raise HTTPException(415, f"Tipo não permitido: {arquivo.content_type}")

    # 2. Ler arquivo e verificar tamanho
    conteudo = await arquivo.read(MAX_SIZE + 1)
    if len(conteudo) > MAX_SIZE:
        raise HTTPException(413, f"Arquivo muito grande (máx {settings.UPLOAD_MAX_SIZE_MB}MB)")

    # 3. Verificar magic bytes
    ext = detectar_extensao(conteudo)
    if not ext:
        raise HTTPException(415, "Formato de imagem não reconhecido")

    # 4. Salvar com UUID no path seguro
    nome_arquivo = f"{uuid.uuid4()}.{ext}"
    dir_upload = Path(settings.STORAGE_PATH) / "uploads" / str(usuario.estudio_id) / "portfolio"
    dir_upload.mkdir(parents=True, exist_ok=True)
    caminho = dir_upload / nome_arquivo

    with open(caminho, "wb") as f:
        f.write(conteudo)

    # 5. Strip EXIF metadata para proteger privacidade
    try:
        from PIL import Image
        img = Image.open(caminho)
        data = list(img.getdata())
        img_sem_exif = Image.new(img.mode, img.size)
        img_sem_exif.putdata(data)
        img_sem_exif.save(caminho)
    except Exception:
        pass  # Se Pillow falhar, manter arquivo original

    # 6. Criar registro no banco
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
    """Serve imagem autenticada — nunca expõe o caminho real."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id,
            Portfolio.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Imagem não encontrada")

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(item.estudio_id)
        / "portfolio"
        / item.imagem_path
    )
    if not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado")

    return FileResponse(str(caminho))


@router.delete("/{id}", status_code=204)
async def arquivar_portfolio(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Soft delete — oculta a foto (ADR-004)."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id,
            Portfolio.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
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
    """Publica ou torna privada uma imagem. Exige autorização explícita para publicar."""
    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == id, Portfolio.estudio_id == usuario.estudio_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")

    if visibilidade == VisibilidadePortfolio.PUBLICO and not autorizado:
        raise HTTPException(400, "É necessário confirmar autorização para publicar")

    item.visibilidade = visibilidade
    if autorizado:
        item.autorizado_publicacao = True
    await session.flush()
    await session.refresh(item)
    return item
