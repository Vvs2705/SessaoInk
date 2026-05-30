"""Model de Cliente."""

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Cliente(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "clientes"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nome: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    foto_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
