"""Router de Estúdio — perfil, configurações e dados públicos."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.usuario import Estudio, Usuario

router = APIRouter(prefix="/estudio", tags=["estudio"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class EstudioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    slug: str
    bio: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    telefone: Optional[str] = None
    instagram: Optional[str] = None
    email_notificacao: Optional[str] = None

    model_config = {"from_attributes": True}


class EstudioAtualizarRequest(BaseModel):
    nome: Optional[str] = None
    bio: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    telefone: Optional[str] = None
    instagram: Optional[str] = None
    email_notificacao: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=EstudioResponse)
async def obter_estudio(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retorna os dados do estúdio do usuário autenticado."""
    result = await session.execute(
        select(Estudio).where(
            Estudio.id == usuario.estudio_id,
            Estudio.ativo == True,
        )
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estúdio não encontrado",
        )
    return estudio


@router.patch("/", response_model=EstudioResponse)
async def atualizar_estudio(
    dados: EstudioAtualizarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Atualiza dados do estúdio. Apenas ADMIN pode alterar."""
    from app.models.usuario import TipoUsuario

    if usuario.tipo != TipoUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem atualizar os dados do estúdio",
        )

    result = await session.execute(
        select(Estudio).where(
            Estudio.id == usuario.estudio_id,
            Estudio.ativo == True,
        )
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estúdio não encontrado",
        )

    # Atualizar apenas campos enviados (patch parcial)
    campos = dados.model_dump(exclude_unset=True)
    for campo, valor in campos.items():
        setattr(estudio, campo, valor)

    await session.commit()
    await session.refresh(estudio)
    return estudio


@router.get("/equipe", response_model=list[dict])
async def listar_equipe(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Lista todos os usuários ativos do estúdio."""
    result = await session.execute(
        select(Usuario).where(
            Usuario.estudio_id == usuario.estudio_id,
            Usuario.ativo == True,
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
