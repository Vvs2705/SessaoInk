"""P0-07 — Testes de hardening de JWT e refresh token."""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

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


def _claims_validas(**extra):
    now = datetime.now(UTC)
    base = {
        "sub": "x",
        "type": "access",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    base.update(extra)
    return base


def test_token_alg_none_eh_rejeitado():
    bad = jwt.encode(_claims_validas(), key=None, algorithm="none")
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_com_outro_algoritmo_hmac_eh_rejeitado():
    # Mesmo segredo, algoritmo fora da allowlist (só HS256 é aceito).
    bad = jwt.encode(_claims_validas(), settings.SECRET_KEY, algorithm="HS512")
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_com_segredo_errado_eh_rejeitado():
    bad = jwt.encode(
        _claims_validas(), "outro-segredo-qualquer-com-32-chars!", algorithm="HS256"
    )
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_expirado_eh_rejeitado():
    passado = datetime.now(UTC) - timedelta(minutes=10)
    bad = jwt.encode(
        _claims_validas(iat=passado, exp=passado + timedelta(minutes=1)),
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    with pytest.raises(ValueError):
        decodificar_token(bad)


def test_token_sem_exp_eh_rejeitado():
    claims = _claims_validas()
    del claims["exp"]
    bad = jwt.encode(claims, settings.SECRET_KEY, algorithm="HS256")
    with pytest.raises(ValueError):
        decodificar_token(bad)
