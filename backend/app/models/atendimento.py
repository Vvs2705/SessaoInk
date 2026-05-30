"""Model de Atendimento."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class StatusOperacional(str, enum.Enum):
    SOLICITADO = "SOLICITADO"
    EM_ANALISE = "EM_ANALISE"
    AGUARDANDO_SINAL = "AGUARDANDO_SINAL"
    CONFIRMADO = "CONFIRMADO"
    EM_ATENDIMENTO = "EM_ATENDIMENTO"
    FINALIZADO = "FINALIZADO"
    REAGENDADO = "REAGENDADO"
    CANCELADO_CLIENTE = "CANCELADO_CLIENTE"
    CANCELADO_ESTUDIO = "CANCELADO_ESTUDIO"
    NAO_COMPARECEU = "NAO_COMPARECEU"
    RETOQUE = "RETOQUE"


class StatusFinanceiro(str, enum.Enum):
    PENDENTE = "PENDENTE"
    SINAL_PAGO = "SINAL_PAGO"
    PAGO_PARCIAL = "PAGO_PARCIAL"
    PAGO_TOTAL = "PAGO_TOTAL"
    ISENTO = "ISENTO"
    ESTORNADO = "ESTORNADO"


class TipoAtendimento(str, enum.Enum):
    TATUAGEM = "TATUAGEM"
    CONSULTA = "CONSULTA"
    RETOQUE = "RETOQUE"
    FLASH = "FLASH"


class FormaPagamento(str, enum.Enum):
    PIX = "PIX"
    DINHEIRO = "DINHEIRO"
    CARTAO_DEBITO = "CARTAO_DEBITO"
    CARTAO_CREDITO = "CARTAO_CREDITO"
    TRANSFERENCIA = "TRANSFERENCIA"
    OUTRO = "OUTRO"


class Atendimento(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "atendimentos"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=True, index=True
    )
    artista_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=True, index=True
    )
    status_operacional: Mapped[StatusOperacional] = mapped_column(
        Enum(StatusOperacional, name="status_operacional"),
        nullable=False,
        default=StatusOperacional.SOLICITADO,
        index=True,
    )
    status_financeiro: Mapped[StatusFinanceiro] = mapped_column(
        Enum(StatusFinanceiro, name="status_financeiro"),
        nullable=False,
        default=StatusFinanceiro.PENDENTE,
    )
    tipo: Mapped[TipoAtendimento] = mapped_column(
        Enum(TipoAtendimento, name="tipo_atendimento"),
        nullable=False,
        default=TipoAtendimento.TATUAGEM,
    )
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    parte_corpo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estilo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tamanho_cm: Mapped[str | None] = mapped_column(String(50), nullable=True)
    valor_total: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    valor_sinal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    forma_pagamento: Mapped[FormaPagamento | None] = mapped_column(
        Enum(FormaPagamento, name="forma_pagamento"), nullable=True
    )
    notas_privadas: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_sessao: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    duracao_minutos: Mapped[int | None] = mapped_column(Integer, nullable=True)

    cliente: Mapped["Cliente" | None] = relationship(
        "Cliente", foreign_keys=[cliente_id], lazy="joined"
    )

    imagens: Mapped[list["AtendimentoImagem"]] = relationship(
        "AtendimentoImagem", back_populates="atendimento", cascade="all, delete-orphan"
    )


class AtendimentoImagem(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "atendimento_imagens"

    atendimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("atendimentos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    imagem_path: Mapped[str] = mapped_column(String(500), nullable=False)

    atendimento: Mapped["Atendimento"] = relationship(
        "Atendimento", back_populates="imagens"
    )
