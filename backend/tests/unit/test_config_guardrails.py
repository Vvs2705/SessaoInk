"""P0-08 — Guardrails de produção na inicialização."""

import pytest

from app.core.config import Settings

_PROD_OK = dict(
    ENVIRONMENT="production",
    DEBUG=False,
    SECRET_KEY="x" * 40,
    ALLOWED_ORIGINS="https://sessao-ink.vercel.app",
    DATABASE_URL="postgresql+asyncpg://u:p@neon.tech/db",
    REDIS_URL="redis://fly-redis:6379",
)


def _settings(**overrides):
    return Settings(_env_file=None, **{**_PROD_OK, **overrides})


def test_producao_valida_inicia():
    s = _settings()
    assert s.ENVIRONMENT == "production"


def test_debug_true_em_producao_aborta():
    with pytest.raises(ValueError):
        _settings(DEBUG=True)


def test_secret_key_curta_aborta():
    with pytest.raises(ValueError):
        _settings(SECRET_KEY="curta")


def test_secret_key_fraca_aborta():
    with pytest.raises(ValueError):
        _settings(SECRET_KEY="changeme")


def test_allowed_origins_vazio_aborta():
    with pytest.raises(ValueError):
        _settings(ALLOWED_ORIGINS="")


def test_allowed_origins_wildcard_aborta():
    with pytest.raises(ValueError):
        _settings(ALLOWED_ORIGINS="*")


def test_database_localhost_aborta():
    with pytest.raises(ValueError):
        _settings(DATABASE_URL="postgresql+asyncpg://u:p@localhost/db")


def test_redis_localhost_aborta():
    with pytest.raises(ValueError):
        _settings(REDIS_URL="redis://127.0.0.1:6379")


def test_desenvolvimento_nao_aplica_guardrails():
    # Config "insegura" em dev é permitida (localhost, key curta)
    s = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        SECRET_KEY="short",
        DATABASE_URL="postgresql+asyncpg://u:p@localhost/db",
        REDIS_URL="redis://localhost:6379",
    )
    assert s.ENVIRONMENT == "development"
