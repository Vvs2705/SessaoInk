"""Mixins reutilizáveis para os modelos SQLAlchemy."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column


class UUIDMixin:
    """Chave primária UUID v4."""

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )


class TimestampMixin:
    """Campos de auditoria de tempo."""

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Soft delete — nunca remove fisicamente do banco."""

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
