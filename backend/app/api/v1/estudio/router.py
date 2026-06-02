"""Router de Estúdio — perfil, branding (logo/foto), slug e equipe."""

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual, require_role
from app.core.database import get_session
from app.core.slug import SlugInvalidoError, slugify, validar_slug
from app.core.storage import montar_key, remover_objeto, resposta_imagem
from app.core.upload_security import processar_upload
from app.models.usuario import Estudio, TipoUsuario, Usuario

router = APIRouter(prefix="/estudio", tags=["estudio"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class EstudioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    slug: str
    bio: str | None = None
    cidade: str | None = None
    uf: str | None = None
    telefone: str | None = None
    instagram: str | None = None
    email_notificacao: str | None = None
    has_logo: bool = False
    has_foto: bool = False

    @classmethod
    def de_estudio(cls, estudio: Estudio) -> "EstudioResponse":
        return cls(
            id=estudio.id,
            nome=estudio.nome,
            slug=estudio.slug,
            bio=estudio.bio,
            cidade=estudio.cidade,
            uf=estudio.uf,
            telefone=estudio.telefone,
            instagram=estudio.instagram,
            email_notificacao=estudio.email_notificacao,
            has_logo=bool(estudio.logo_path),
            has_foto=bool(estudio.foto_path),
        )


class EstudioAtualizarRequest(BaseModel):
    nome: str | None = None
    bio: str | None = None
    cidade: str | None = None
    uf: str | None = None
    telefone: str | None = None
    instagram: str | None = None
    email_notificacao: str | None = None


class SlugAlterarRequest(BaseModel):
    slug: str


class SlugDisponibilidadeResponse(BaseModel):
    slug: str
    disponivel: bool
    motivo: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _carregar_estudio(session: AsyncSession, estudio_id: uuid.UUID) -> Estudio:
    result = await session.execute(
        select(Estudio).where(Estudio.id == estudio_id, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Estúdio não encontrado"
        )
    return estudio


async def _slug_em_uso(session: AsyncSession, slug: str, exceto_id: uuid.UUID) -> bool:
    result = await session.execute(
        select(Estudio.id).where(Estudio.slug == slug, Estudio.id != exceto_id)
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Perfil
# ---------------------------------------------------------------------------


@router.get("/", response_model=EstudioResponse)
async def obter_estudio(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retorna os dados do estúdio do usuário autenticado."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    return EstudioResponse.de_estudio(estudio)


@router.patch("/", response_model=EstudioResponse)
async def atualizar_estudio(
    dados: EstudioAtualizarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Atualiza dados do estúdio. Apenas ADMIN."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    campos = dados.model_dump(exclude_unset=True)
    for campo, valor in campos.items():
        setattr(estudio, campo, valor)
    await session.commit()
    await session.refresh(estudio)
    return EstudioResponse.de_estudio(estudio)


# ---------------------------------------------------------------------------
# Slug personalizável (link do portal)
# ---------------------------------------------------------------------------


@router.get("/slug/sugestao", response_model=SlugDisponibilidadeResponse)
async def sugerir_slug(
    base: str,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Sugere/valida um slug a partir de um texto (ex.: nome do estúdio)."""
    candidato = slugify(base)
    try:
        candidato = validar_slug(candidato)
    except SlugInvalidoError as e:
        return SlugDisponibilidadeResponse(
            slug=candidato, disponivel=False, motivo=str(e)
        )
    if await _slug_em_uso(session, candidato, usuario.estudio_id):
        return SlugDisponibilidadeResponse(
            slug=candidato, disponivel=False, motivo="Esse link já está em uso."
        )
    return SlugDisponibilidadeResponse(slug=candidato, disponivel=True)


@router.patch("/slug", response_model=EstudioResponse)
async def alterar_slug(
    dados: SlugAlterarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Altera o slug (link do portal). Apenas ADMIN.

    Atenção: links antigos deixam de funcionar após a troca.
    """
    try:
        novo = validar_slug(dados.slug)
    except SlugInvalidoError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e

    if await _slug_em_uso(session, novo, usuario.estudio_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Esse link já está em uso.")

    estudio = await _carregar_estudio(session, usuario.estudio_id)
    estudio.slug = novo
    await session.commit()
    await session.refresh(estudio)
    return EstudioResponse.de_estudio(estudio)


# ---------------------------------------------------------------------------
# Branding — logo e foto
# ---------------------------------------------------------------------------


async def _upload_branding(
    session: AsyncSession,
    estudio_id: uuid.UUID,
    arquivo: UploadFile,
    campo: str,
) -> Estudio:
    estudio = await _carregar_estudio(session, estudio_id)
    nome_antigo = getattr(estudio, campo)
    novo_nome, _ = await processar_upload(arquivo, str(estudio_id), "branding")
    setattr(estudio, campo, novo_nome)
    await session.commit()
    await session.refresh(estudio)
    # Remove o arquivo antigo do storage (best-effort) após persistir o novo.
    if nome_antigo and nome_antigo != novo_nome:
        try:
            await remover_objeto(montar_key(str(estudio_id), "branding", nome_antigo))
        except Exception:
            pass
    return estudio


@router.post("/logo", response_model=EstudioResponse)
async def upload_logo(
    arquivo: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Envia/substitui a logo do estúdio. Apenas ADMIN."""
    estudio = await _upload_branding(session, usuario.estudio_id, arquivo, "logo_path")
    return EstudioResponse.de_estudio(estudio)


@router.post("/foto", response_model=EstudioResponse)
async def upload_foto(
    arquivo: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Envia/substitui a foto/avatar do estúdio. Apenas ADMIN."""
    estudio = await _upload_branding(session, usuario.estudio_id, arquivo, "foto_path")
    return EstudioResponse.de_estudio(estudio)


@router.get("/logo")
async def servir_logo(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Serve a logo do estúdio do usuário autenticado."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    if not estudio.logo_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logo não cadastrada")
    return await resposta_imagem(
        montar_key(str(estudio.id), "branding", estudio.logo_path)
    )


@router.get("/foto")
async def servir_foto(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Serve a foto/avatar do estúdio do usuário autenticado."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    if not estudio.foto_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto não cadastrada")
    return await resposta_imagem(
        montar_key(str(estudio.id), "branding", estudio.foto_path)
    )


@router.delete("/logo", response_model=EstudioResponse)
async def remover_logo(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Remove a logo do estúdio. Apenas ADMIN."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    if estudio.logo_path:
        antigo = estudio.logo_path
        estudio.logo_path = None
        await session.commit()
        await session.refresh(estudio)
        try:
            await remover_objeto(montar_key(str(estudio.id), "branding", antigo))
        except Exception:
            pass
    return EstudioResponse.de_estudio(estudio)


@router.delete("/foto", response_model=EstudioResponse)
async def remover_foto(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Remove a foto/avatar do estúdio. Apenas ADMIN."""
    estudio = await _carregar_estudio(session, usuario.estudio_id)
    if estudio.foto_path:
        antigo = estudio.foto_path
        estudio.foto_path = None
        await session.commit()
        await session.refresh(estudio)
        try:
            await remover_objeto(montar_key(str(estudio.id), "branding", antigo))
        except Exception:
            pass
    return EstudioResponse.de_estudio(estudio)


# ---------------------------------------------------------------------------
# Equipe
# ---------------------------------------------------------------------------


@router.get("/equipe", response_model=list[dict])
async def listar_equipe(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Lista todos os usuários ativos do estúdio."""
    result = await session.execute(
        select(Usuario).where(
            Usuario.estudio_id == usuario.estudio_id,
            Usuario.ativo,
        )
    )
    membros = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "nome": m.nome,
            "email": m.email,
            "tipo": m.tipo.value,
        }
        for m in membros
    ]
