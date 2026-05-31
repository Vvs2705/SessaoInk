"""Modelos SaaS: Plano e Assinatura."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class StatusPlano(str, enum.Enum):
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class StatusAssinatura(str, enum.Enum):
    TRIAL = "TRIAL"
    ATIVA = "ATIVA"
    INADIMPLENTE = "INADIMPLENTE"
    CANCELADA = "CANCELADA"
    SUSPENSA = "SUSPENSA"


class Plano(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "planos"

    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[StatusPlano] = mapped_column(Enum(StatusPlano, name="status_plano"), default=StatusPlano.ATIVO)
    preco_mensal: Mapped[float | None] = mapped_column(nullable=True)
    # Limites em JSON: {"usuarios": 3, "clientes": 100, "storage_mb": 500, ...}
    limites: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    externo_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # Stripe price ID


class Assinatura(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "assinaturas"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False, unique=True, index=True
    )
    plano_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("planos.id"), nullable=True
    )
    status: Mapped[StatusAssinatura] = mapped_column(
        Enum(StatusAssinatura, name="status_assinatura"),
        default=StatusAssinatura.TRIAL, nullable=False
    )
    trial_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelar_no_fim: Mapped[bool] = mapped_column(Boolean, default=False)
    externo_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # Stripe subscription ID
    externo_customer_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
