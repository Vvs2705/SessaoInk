
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "SessãoInk API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALLOWED_ORIGINS: str | list[str] = ["http://localhost:3000"]

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


settings = Settings()
