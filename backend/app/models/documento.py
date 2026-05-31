"""Model de Documento e Termo."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class TipoDocumento(enum.StrEnum):
    POLITICA_PRIVACIDADE = "POLITICA_PRIVACIDADE"
    TERMOS_USO = "TERMOS_USO"
    CONSENTIMENTO = "CONSENTIMENTO"
    AUTORIZACAO_IMAGEM = "AUTORIZACAO_IMAGEM"
    POLITICA_SINAL = "POLITICA_SINAL"
    AFTERCARE = "AFTERCARE"
    OUTRO = "OUTRO"


class Documento(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documentos"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("clientes.id"), nullable=True
    )
    atendimento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("atendimentos.id"), nullable=True
    )
    tipo: Mapped[TipoDocumento] = mapped_column(
        Enum(TipoDocumento, name="tipo_documento"), nullable=False
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    conteudo: Mapped[str | None] = mapped_column(Text, nullable=True)
    versao: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    assinado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    data_assinatura: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_assinatura: Mapped[str | None] = mapped_column(String(45), nullable=True)
    trilha_aceite: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    nome_assinante: Mapped[str | None] = mapped_column(String(200), nullable=True)


class AcaoLink(enum.StrEnum):
    VISUALIZAR = "VISUALIZAR"
    ASSINAR = "ASSINAR"


class DocumentoLinkAcesso(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documento_links_acesso"

    documento_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("documentos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    acao: Mapped[AcaoLink] = mapped_column(Enum(AcaoLink, name="acao_link"), nullable=False)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revogado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ip_geracao: Mapped[str | None] = mapped_column(String(45), nullable=True)
    ip_uso: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent_uso: Mapped[str | None] = mapped_column(String(500), nullable=True)
