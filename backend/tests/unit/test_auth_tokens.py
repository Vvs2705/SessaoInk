"""P0-07 — Testes de hardening de JWT e refresh token."""

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    criar_access_token,
    criar_refresh_token,
    decodificar_token,
    hash_refresh_token,
)


def test_access_token_contem_claims_de_seguranca():
    token = criar_access_token({"sub": "user-1", "role": "ADMIN"})
    payload = decodificar_token(token)
    assert payload["sub"] == "user-1"
    assert payload["type"] == "access"
    assert payload["iss"] == settings.JWT_ISSUER
    assert payload["aud"] == settings.JWT_AUDIENCE
    assert payload["jti"]
    assert payload["iat"]
    assert payload["exp"]


def test_token_sem_issuer_aud_eh_rejeitado():
    bad = jwt.encode(
        {"sub": "x", "type": "access"}, settings.SECRET_KEY, algorithm="HS256"
    )
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_com_issuer_errado_eh_rejeitado():
    bad = jwt.encode(
        {
            "sub": "x",
            "type": "access",
            "iss": "atacante",
            "aud": settings.JWT_AUDIENCE,
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_tipo_diferente_de_access_eh_rejeitado():
    bad = jwt.encode(
        {
            "sub": "x",
            "type": "refresh",
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
        },
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_refresh_token_alta_entropia_e_unico():
    t1 = criar_refresh_token()
    t2 = criar_refresh_token()
    assert t1 != t2
    assert len(t1) >= 40  # token_urlsafe(48) → ~64 chars


def test_hash_refresh_token_eh_sha256_estavel():
    t = criar_refresh_token()
    h = hash_refresh_token(t)
    assert len(h) == 64
    assert h == hash_refresh_token(t)  # determinístico
    assert h != t  # nunca igual ao valor puro
