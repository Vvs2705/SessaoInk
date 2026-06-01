
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores claramente inseguros/placeholder para SECRET_KEY
_SECRET_KEYS_FRACAS = {
    "changeme",
    "change-me",
    "secret",
    "secret-key",
    "your-secret-key",
    "dev",
    "development",
    "test",
    "default",
}


class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "SessãoInk API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Claims JWT — validados no decodificador (defesa contra token confusion)
    JWT_ISSUER: str = "sessaoink-api"
    JWT_AUDIENCE: str = "sessaoink-app"
    ALLOWED_ORIGINS: str | list[str] = ["http://localhost:3000"]

    # Trusted proxy — o backend roda atrás de Vercel (proxy) + Fly edge.
    # Quando True, `get_client_ip` confia em X-Forwarded-For/Fly-Client-IP.
    # Desligue apenas se o backend passar a receber tráfego direto não confiável.
    TRUSTED_PROXY_ENABLED: bool = True

    # Database
    DATABASE_URL: str
    REDIS_URL: str

    # Storage
    STORAGE_PATH: str = "./storage"
    UPLOAD_MAX_SIZE_MB: int = 15

    # Observabilidade
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1

    # Email via Resend (resend.com) — notificações de orçamento
    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "SessãoInk <onboarding@resend.dev>"
    APP_URL: str = "https://sessao-ink.vercel.app"

    # LGPD
    LGPD_ORCAMENTO_RETENCAO_DIAS: int = 180
    LGPD_PRIVACIDADE_VERSAO: str = "2026-06-01"
    LGPD_TERMOS_VERSAO: str = "2026-06-01"
    LGPD_RETENTION_TOKEN: str = ""

    # CSRF
    CSRF_STRICT_MODE: bool = True

    # Vendas / Billing
    LEADS_EMAIL: str = ""  # destino das notificações de interesse em planos
    MERCADO_PAGO_ACCESS_TOKEN: str = ""  # token do gateway (preenchido depois)
    MERCADO_PAGO_WEBHOOK_SECRET: str = ""

    # Config model configuration
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @model_validator(mode="after")
    def _guardrails_producao(self) -> "Settings":
        """P0-08 — aborta o startup se a config de produção for insegura.

        Em produção, configuração insegura encerra a aplicação ANTES de subir o
        servidor (falha no release_command do Fly → deploy aborta sem downtime,
        mantendo a versão anterior no ar).
        """
        if self.ENVIRONMENT != "production":
            return self

        erros: list[str] = []

        if self.DEBUG:
            erros.append("DEBUG deve ser false em produção")

        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            erros.append("SECRET_KEY deve ter pelo menos 32 caracteres em produção")
        elif self.SECRET_KEY.strip().lower() in _SECRET_KEYS_FRACAS:
            erros.append("SECRET_KEY é um valor fraco/placeholder")

        origins = self.ALLOWED_ORIGINS
        if isinstance(origins, str):
            origins = [o.strip() for o in origins.split(",") if o.strip()]
        if not origins:
            erros.append("ALLOWED_ORIGINS não pode ser vazio em produção")
        if any("*" in o for o in origins):
            erros.append("ALLOWED_ORIGINS não pode conter wildcard (*) em produção")

        if any(host in self.DATABASE_URL for host in ("localhost", "127.0.0.1")):
            erros.append("DATABASE_URL não pode apontar para localhost em produção")
        if any(host in self.REDIS_URL for host in ("localhost", "127.0.0.1")):
            erros.append("REDIS_URL não pode apontar para localhost em produção")

        if not self.LGPD_RETENTION_TOKEN or len(self.LGPD_RETENTION_TOKEN) < 32:
            erros.append("LGPD_RETENTION_TOKEN deve ter pelo menos 32 caracteres em producao")

        if erros:
            raise ValueError(
                "Configuração de produção insegura — startup abortado:\n  - "
                + "\n  - ".join(erros)
            )
        return self


settings = Settings()
