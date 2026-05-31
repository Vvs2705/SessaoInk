"""Modelo de Convite para usuários do estúdio."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin
from app.models.usuario import TipoUsuario


class StatusConvite(enum.StrEnum):
    PENDENTE = "PENDENTE"
    ACEITO = "ACEITO"
    EXPIRADO = "EXPIRADO"
    REVOGADO = "REVOGADO"


class Convite(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "convites"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    role: Mapped[TipoUsuario] = mapped_column(
        Enum(TipoUsuario, name="tipo_usuario"), nullable=False, default=TipoUsuario.ARTISTA
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    status: Mapped[StatusConvite] = mapped_column(
        Enum(StatusConvite, name="status_convite"), default=StatusConvite.PENDENTE, nullable=False
    )
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    aceito_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    convidado_por_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
