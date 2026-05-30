"""Dependências de autenticação para injeção via FastAPI."""

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import decodificar_token
from app.models.usuario import Usuario


async def get_usuario_atual(
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> Usuario:
    """Valida o cookie access_token e retorna o usuário autenticado."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not access_token:
        raise credentials_exception

    try:
        payload = decodificar_token(access_token)
        usuario_id: str = payload.get("sub")
        if not usuario_id:
            raise credentials_exception
    except ValueError:
        raise credentials_exception

    result = await session.execute(
        select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.ativo == True,
        )
    )
    usuario = result.scalar_one_or_none()

    if not usuario:
        raise credentials_exception

    return usuario


from typing import Any
from app.models.usuario import TipoUsuario

def requires_roles(*roles: TipoUsuario):
    """Dependência que valida se o usuário possui alguma das permissões/funções informadas."""
    async def dependency(usuario: Usuario = Depends(get_usuario_atual)) -> Usuario:
        if usuario.tipo not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão insuficiente para esta operação",
            )
        return usuario
    return dependency


def verificar_tenant(objeto: Any, usuario: Usuario) -> None:
    """Verifica se o recurso pertence ao mesmo estúdio do usuário autenticado (tenant isolation)."""
    if getattr(objeto, "estudio_id", None) != usuario.estudio_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: o recurso solicitado pertence a outro estúdio",
        )
