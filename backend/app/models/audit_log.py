"""P0-10 — Modelo de auditoria transacional (append-only)."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import UUIDMixin


class AuditLog(Base, UUIDMixin):
    """Registro imutável de evento de auditoria.

    Append-only: a aplicação nunca edita nem deleta fisicamente estes registros.
    `acao` segue convenção pontilhada: auth.login.success, financeiro.updated,
    documento.signed, usuario.role_changed, etc.
    """

    __tablename__ = "audit_logs"

    # Tenant — nulo para eventos sem estúdio (ex.: falha de login de email inexistente)
    estudio_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, nullable=True, index=True
    )
    # Ator — nulo para ações anônimas/públicas
    actor_usuario_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    actor_tipo: Mapped[str | None] = mapped_column(String(20), nullable=True)

    acao: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entidade: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entidade_id: Mapped[str | None] = mapped_column(String(80), nullable=True)

    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Metadados livres (JSONB no Postgres, JSON no SQLite). Atributo `dados` para
    # não colidir com Base.metadata do SQLAlchemy.
    dados: Mapped[dict | None] = mapped_column("metadata_json", JSON, nullable=True)

    created_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
