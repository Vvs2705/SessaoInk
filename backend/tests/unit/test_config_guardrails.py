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
    LGPD_RETENTION_TOKEN="x" * 40,
    INTERNAL_PROXY_SECRET="x" * 40,
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


def test_lgpd_retention_token_curto_aborta():
    with pytest.raises(ValueError):
        _settings(LGPD_RETENTION_TOKEN="curto")


def test_proxy_secret_ausente_com_trusted_proxy_aborta():
    # TRUSTED_PROXY_ENABLED (padrão) sem INTERNAL_PROXY_SECRET → XFF falsificável.
    with pytest.raises(ValueError):
        _settings(INTERNAL_PROXY_SECRET="")


def test_proxy_secret_curto_aborta():
    with pytest.raises(ValueError):
        _settings(INTERNAL_PROXY_SECRET="curto")


def test_trusted_proxy_desligado_nao_exige_secret():
    # Sem confiar em proxy, o XFF é ignorado — o segredo deixa de ser necessário.
    s = _settings(TRUSTED_PROXY_ENABLED=False, INTERNAL_PROXY_SECRET="")
    assert s.TRUSTED_PROXY_ENABLED is False


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


# ── P0-04 — guardrails de go-live de pagamentos ──────────────────────────────

_GO_LIVE_OK = dict(
    PAGAMENTOS_GO_LIVE=True,
    MERCADO_PAGO_ACCESS_TOKEN="tok-prod-xyz",
    MERCADO_PAGO_PUBLIC_KEY="pub-prod-xyz",
    MERCADO_PAGO_WEBHOOK_SECRET="whsec-xyz",
    APP_URL="https://sessao-ink.vercel.app",
    CSRF_STRICT_MODE=True,
    SENTRY_DSN="https://abc@o1.ingest.sentry.io/1",
)


def test_go_live_desligado_nao_exige_mercadopago():
    # Estado atual de produção: go-live off → sem exigências de MP.
    s = _settings(PAGAMENTOS_GO_LIVE=False)
    assert s.PAGAMENTOS_GO_LIVE is False


def test_go_live_completo_inicia():
    s = _settings(**_GO_LIVE_OK)
    assert s.PAGAMENTOS_GO_LIVE is True


def test_go_live_sem_webhook_secret_aborta():
    with pytest.raises(ValueError):
        _settings(**{**_GO_LIVE_OK, "MERCADO_PAGO_WEBHOOK_SECRET": ""})


def test_go_live_sem_access_token_aborta():
    with pytest.raises(ValueError):
        _settings(**{**_GO_LIVE_OK, "MERCADO_PAGO_ACCESS_TOKEN": ""})


def test_go_live_app_url_sem_https_aborta():
    with pytest.raises(ValueError):
        _settings(**{**_GO_LIVE_OK, "APP_URL": "http://sessao-ink.vercel.app"})


def test_go_live_csrf_nao_estrito_aborta():
    with pytest.raises(ValueError):
        _settings(**{**_GO_LIVE_OK, "CSRF_STRICT_MODE": False})


def test_go_live_sem_sentry_aborta():
    with pytest.raises(ValueError):
        _settings(**{**_GO_LIVE_OK, "SENTRY_DSN": ""})
