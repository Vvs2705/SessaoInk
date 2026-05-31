"""Models de Usuário e Estúdio."""

import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class TipoUsuario(enum.StrEnum):
    ADMIN = "ADMIN"
    ARTISTA = "ARTISTA"
    RECEPCIONISTA = "RECEPCIONISTA"


class Estudio(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "estudios"

    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    bio: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Email para receber notificações de novos orçamentos pelo portal público
    email_notificacao: Mapped[str | None] = mapped_column(String(320), nullable=True)

    usuarios: Mapped[list["Usuario"]] = relationship(
        "Usuario", back_populates="estudio", lazy="selectin"
    )


class Usuario(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "usuarios"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    senha_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    tipo: Mapped[TipoUsuario] = mapped_column(
        Enum(TipoUsuario, name="tipo_usuario"),
        nullable=False,
        default=TipoUsuario.ARTISTA,
    )

    estudio: Mapped["Estudio"] = relationship("Estudio", back_populates="usuarios")
