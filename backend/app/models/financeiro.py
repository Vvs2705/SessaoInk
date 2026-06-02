"""Models de Financeiro e Estoque."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
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
    RESERVA = "RESERVA"
    ESTORNO = "ESTORNO"
    AJUSTE = "AJUSTE"


class StatusLancamento(enum.StrEnum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    PARCIAL = "PARCIAL"
    CANCELADO = "CANCELADO"
    ESTORNADO = "ESTORNADO"


class OrigemLancamento(enum.StrEnum):
    """De onde o lançamento se originou — para rastreabilidade e idempotência."""

    MANUAL = "MANUAL"
    ATENDIMENTO = "ATENDIMENTO"
    COMISSAO = "COMISSAO"
    ASSINATURA = "ASSINATURA"
    SISTEMA = "SISTEMA"


class Recorrencia(enum.StrEnum):
    NENHUMA = "NENHUMA"
    SEMANAL = "SEMANAL"
    MENSAL = "MENSAL"
    ANUAL = "ANUAL"


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
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True, index=True
    )
    tipo: Mapped[TipoLancamento] = mapped_column(
        Enum(TipoLancamento, name="tipo_lancamento"), nullable=False, index=True
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
        index=True,
    )
    data_prevista: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    data_realizada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Classificação contábil (Track B) ---
    categoria: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    centro_custo: Mapped[str | None] = mapped_column(String(80), nullable=True)
    origem: Mapped[OrigemLancamento] = mapped_column(
        Enum(OrigemLancamento, name="origem_lancamento"),
        default=OrigemLancamento.MANUAL,
        server_default=OrigemLancamento.MANUAL.value,
        nullable=False,
    )

    # --- Decomposição de valor (bruto / taxa de gateway / líquido) ---
    valor_bruto: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    valor_taxa: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    valor_liquido: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # --- Datas contábeis ---
    competencia: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    data_vencimento: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # --- Comissão ---
    comissao_percentual: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    lancamento_origem_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("lancamentos.id"), nullable=True, index=True
    )

    # --- Recorrência / parcelamento ---
    recorrencia: Mapped[Recorrencia] = mapped_column(
        Enum(Recorrencia, name="recorrencia_lancamento"),
        default=Recorrencia.NENHUMA,
        server_default=Recorrencia.NENHUMA.value,
        nullable=False,
    )
    parcela_numero: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcela_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    grupo_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True, index=True)

    # --- Auditoria de autoria/cancelamento (quem criou / cancelou) ---
    criado_por_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    cancelado_por_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("usuarios.id"), nullable=True
    )
    cancelado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    motivo_cancelamento: Mapped[str | None] = mapped_column(String(300), nullable=True)


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
