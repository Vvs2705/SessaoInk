"""Models de Financeiro e Estoque."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class TipoLancamento(enum.StrEnum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"
    COMISSAO = "COMISSAO"
    SINAL = "SINAL"


class StatusLancamento(enum.StrEnum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    CANCELADO = "CANCELADO"
    ESTORNADO = "ESTORNADO"


class FormaPagamentoFin(enum.StrEnum):
    PIX = "PIX"
    DINHEIRO = "DINHEIRO"
    CARTAO_DEBITO = "CARTAO_DEBITO"
    CARTAO_CREDITO = "CARTAO_CREDITO"
    TRANSFERENCIA = "TRANSFERENCIA"
    OUTRO = "OUTRO"


class Lancamento(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lancamentos"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    atendimento_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("atendimentos.id"), nullable=True
    )
    artista_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    tipo: Mapped[TipoLancamento] = mapped_column(
        Enum(TipoLancamento, name="tipo_lancamento"), nullable=False
    )
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    valor: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    forma_pagamento: Mapped[FormaPagamentoFin | None] = mapped_column(
        Enum(FormaPagamentoFin, name="forma_pagamento_fin"), nullable=True
    )
    status: Mapped[StatusLancamento] = mapped_column(
        Enum(StatusLancamento, name="status_lancamento"),
        default=StatusLancamento.PENDENTE,
        nullable=False,
    )
    data_prevista: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_realizada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CategoriaEstoque(enum.StrEnum):
    TINTA = "TINTA"
    AGULHA = "AGULHA"
    LUVA = "LUVA"
    PAPEL = "PAPEL"
    PRODUTO = "PRODUTO"
    OUTRO = "OUTRO"


class EstoqueItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "estoque_itens"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria: Mapped[CategoriaEstoque] = mapped_column(
        Enum(CategoriaEstoque, name="categoria_estoque"), nullable=False
    )
    unidade: Mapped[str] = mapped_column(String(20), nullable=False, default="un")
    quantidade_atual: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    quantidade_minima: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    preco_custo: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
