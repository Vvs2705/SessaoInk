"""Funções de segurança: JWT e hashing de senha."""

import hashlib
import secrets
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
    """Cria JWT de acesso com claims completas (iss, aud, jti, type, iat, exp).

    Claims de segurança:
      - type=access  → impede uso de outros tokens como access.
      - iss/aud       → validados no decode (defesa contra token confusion).
      - jti           → identificador único do token (rastreabilidade/revogação futura).
      - iat/exp       → janela temporal.
    """
    now = datetime.now(UTC)
    to_encode = data.copy()
    to_encode.update(
        {
            "type": "access",
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
            "jti": secrets.token_urlsafe(16),
            "iat": now,
            "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        }
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def criar_refresh_token() -> str:
    """Gera refresh token opaco de alta entropia (armazenado como hash no Redis).

    Usa secrets.token_urlsafe(48) (~64 chars, 384 bits de entropia) em vez de
    UUIDv4 (122 bits) — mitiga adivinhação e colisão.
    """
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """SHA-256 do refresh token — só o hash é persistido no Redis.

    Se o armazenamento for comprometido, os tokens em claro não vazam.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decodificar_token(token: str) -> dict[str, Any]:
    """Decodifica e valida access token. Lança ValueError se inválido.

    Valida assinatura, expiração, `iss`, `aud` e `type == "access"`.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except JWTError as e:
        raise ValueError(f"Token inválido: {e}") from e

    if payload.get("type") != "access":
        raise ValueError("Tipo de token inválido — esperado 'access'")

    return payload


# Mantido para compatibilidade — alguns módulos importam uuid daqui historicamente.
__all__ = [
    "hash_senha",
    "verificar_senha",
    "criar_access_token",
    "criar_refresh_token",
    "hash_refresh_token",
    "decodificar_token",
    "uuid",
]
