"""Models de Portfólio e Flash Arts."""

import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class VisibilidadePortfolio(str, enum.Enum):
    PRIVADO = "PRIVADO"
    PUBLICO = "PUBLICO"


class StatusFlash(str, enum.Enum):
    DISPONIVEL = "DISPONIVEL"
    EM_NEGOCIACAO = "EM_NEGOCIACAO"
    RESERVADA = "RESERVADA"
    SINAL_PAGO = "SINAL_PAGO"
    VENDIDA = "VENDIDA"
    ARQUIVADA = "ARQUIVADA"


class Portfolio(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "portfolio"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    artista_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    atendimento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("atendimentos.id"), nullable=True
    )
    imagem_path: Mapped[str] = mapped_column(String(500), nullable=False)
    titulo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    estilo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parte_corpo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    autorizado_publicacao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    visibilidade: Mapped[VisibilidadePortfolio] = mapped_column(
        Enum(VisibilidadePortfolio, name="visibilidade_portfolio"),
        default=VisibilidadePortfolio.PRIVADO,
        nullable=False,
    )


class FlashArt(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "flash_arts"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    artista_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    imagem_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preco: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    tamanho_sugerido: Mapped[str | None] = mapped_column(String(100), nullable=True)
    local_recomendado: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[StatusFlash] = mapped_column(
        Enum(StatusFlash, name="status_flash"),
        default=StatusFlash.DISPONIVEL,
        nullable=False,
        index=True,
    )
