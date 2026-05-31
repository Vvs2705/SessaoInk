"""Dependências de autenticação para injeção via FastAPI."""

import uuid
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
        usuario_id_str: str | None = payload.get("sub")
        if not usuario_id_str:
            raise credentials_exception
        usuario_id = uuid.UUID(usuario_id_str)
    except (ValueError, AttributeError):
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


async def get_estudio_id(
    usuario: Usuario = Depends(get_usuario_atual),
) -> uuid.UUID:
    """Retorna o estudio_id do usuário autenticado."""
    return usuario.estudio_id

