"""Router de Usuários — gerenciamento de perfil do usuário autenticado."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.usuario import Usuario, TipoUsuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class UsuarioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    tipo: TipoUsuario
    estudio_id: uuid.UUID
    ativo: bool
    model_config = {"from_attributes": True}


class AtualizarUsuarioRequest(BaseModel):
    nome: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UsuarioResponse)
async def obter_usuario_atual(
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Retorna os dados do usuário autenticado."""
    return usuario


@router.patch("/me", response_model=UsuarioResponse)
async def atualizar_usuario_atual(
    dados: AtualizarUsuarioRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Atualiza o nome do usuário autenticado."""
    nome = dados.nome.strip()
    if not nome:
        raise HTTPException(status_code=422, detail="Nome não pode estar vazio")

    usuario.nome = nome
    await session.flush()
    await session.refresh(usuario)
    return usuario
