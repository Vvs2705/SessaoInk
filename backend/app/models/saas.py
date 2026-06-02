"""Modelos SaaS: Plano, Assinatura e eventos de pagamento."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class StatusPlano(enum.StrEnum):
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class StatusAssinatura(enum.StrEnum):
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
    externo_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # subscription/preapproval ID
    externo_customer_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(40), nullable=True)  # ex.: "mercadopago"
    ciclo: Mapped[str | None] = mapped_column(String(20), nullable=True)  # mensal/trimestral/...


class PagamentoEvento(Base, UUIDMixin):
    """Inbox de notificações de gateway (idempotência por evento).

    Dedup em (gateway, evento_tipo, recurso_id): se o mesmo evento chegar de novo,
    não reprocessa. Append-only; `processado` marca quando a regra de negócio rodou.
    """

    __tablename__ = "pagamento_eventos"
    __table_args__ = (
        UniqueConstraint(
            "gateway", "evento_tipo", "recurso_id", name="uq_pagamento_evento_dedup"
        ),
    )

    gateway: Mapped[str] = mapped_column(String(40), nullable=False, default="mercadopago")
    evento_tipo: Mapped[str] = mapped_column(String(60), nullable=False)
    recurso_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    estudio_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    assinatura_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    processado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dados: Mapped[dict | None] = mapped_column("payload_json", JSON, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
