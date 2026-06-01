"""Registro de consentimentos LGPD."""

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class Consentimento(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "consentimentos"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    atendimento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("atendimentos.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    origem: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    aceite_privacidade: Mapped[bool] = mapped_column(Boolean, nullable=False)
    aceite_termos: Mapped[bool] = mapped_column(Boolean, nullable=False)
    versao_privacidade: Mapped[str] = mapped_column(String(40), nullable=False)
    versao_termos: Mapped[str] = mapped_column(String(40), nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
