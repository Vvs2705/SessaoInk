"""Funções de segurança: JWT e hashing de senha."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt as _bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_senha(senha: str) -> str:
    """Retorna o hash bcrypt da senha (rounds=12)."""
    salt = _bcrypt.gensalt(rounds=12)
    return _bcrypt.hashpw(senha.encode("utf-8"), salt).decode("utf-8")


def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    """Verifica senha contra o hash armazenado."""
    return _bcrypt.checkpw(senha_plana.encode("utf-8"), senha_hash.encode("utf-8"))


def criar_access_token(data: dict[str, Any]) -> str:
    """Cria JWT de acesso com expiração de ACCESS_TOKEN_EXPIRE_MINUTES."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def criar_refresh_token() -> str:
    """Gera UUID seguro para refresh token (armazenado no Redis)."""
    return str(uuid.uuid4())


def decodificar_token(token: str) -> dict[str, Any]:
    """Decodifica e valida access token. Lança ValueError se inválido.

    Valida explicitamente que `type == "access"` para impedir que refresh tokens
    (ou qualquer outro tipo de token futuro) sejam aceitos como access tokens.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError as e:
        raise ValueError(f"Token inválido: {e}") from e

    if payload.get("type") != "access":
        raise ValueError("Tipo de token inválido — esperado 'access'")

    return payload
