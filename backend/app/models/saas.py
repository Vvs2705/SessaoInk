"""Modelos SaaS: Plano, Assinatura e eventos de pagamento."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.mixins import TimestampMixin, UUIDMixin


class StatusPlano(enum.StrEnum):
    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class StatusAssinatura(enum.StrEnum):
    TRIAL = "TRIAL"
    ATIVA = "ATIVA"
    INADIMPLENTE = "INADIMPLENTE"
    CANCELADA = "CANCELADA"
    SUSPENSA = "SUSPENSA"


class StatusCobranca(enum.StrEnum):
    """Ciclo de vida da cobrança local (criada antes de falar com o gateway)."""

    CRIADA = "CRIADA"
    ENVIADA_GATEWAY = "ENVIADA_GATEWAY"
    PENDENTE = "PENDENTE"
    PAGA = "PAGA"
    EXPIRADA = "EXPIRADA"
    CANCELADA = "CANCELADA"
    FALHA = "FALHA"


class StatusPagamento(enum.StrEnum):
    """Status do pagamento conforme o gateway (Mercado Pago)."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    AUTHORIZED = "AUTHORIZED"
    IN_PROCESS = "IN_PROCESS"
    REJECTED = "REJECTED"
    REFUNDED = "REFUNDED"
    CHARGED_BACK = "CHARGED_BACK"
    CANCELLED = "CANCELLED"


class Plano(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "planos"

    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[StatusPlano] = mapped_column(Enum(StatusPlano, name="status_plano"), default=StatusPlano.ATIVO)
    preco_mensal: Mapped[float | None] = mapped_column(nullable=True)
    # Limites em JSON: {"usuarios": 3, "clientes": 100, "storage_mb": 500, ...}
    limites: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    externo_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # Stripe price ID


class Assinatura(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "assinaturas"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False, unique=True, index=True
    )
    plano_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("planos.id"), nullable=True
    )
    status: Mapped[StatusAssinatura] = mapped_column(
        Enum(StatusAssinatura, name="status_assinatura"),
        default=StatusAssinatura.TRIAL, nullable=False
    )
    trial_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_inicio: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    periodo_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelar_no_fim: Mapped[bool] = mapped_column(Boolean, default=False)
    externo_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # subscription/preapproval ID
    externo_customer_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(40), nullable=True)  # ex.: "mercadopago"
    ciclo: Mapped[str | None] = mapped_column(String(20), nullable=True)  # mensal/trimestral/...
    # Slug do plano (catálogo em app/core/planos.py) — fonte do enforcement de
    # entitlements. No trial guarda o tier oferecido (ex.: "profissional").
    plano_slug: Mapped[str | None] = mapped_column(String(40), nullable=True)


class PagamentoEvento(Base, UUIDMixin):
    """Inbox de notificações de gateway (idempotência por evento).

    Dedup em (gateway, evento_tipo, recurso_id): se o mesmo evento chegar de novo,
    não reprocessa. Append-only; `processado` marca quando a regra de negócio rodou.
    """

    __tablename__ = "pagamento_eventos"
    __table_args__ = (
        UniqueConstraint(
            "gateway", "evento_tipo", "recurso_id", name="uq_pagamento_evento_dedup"
        ),
    )

    gateway: Mapped[str] = mapped_column(String(40), nullable=False, default="mercadopago")
    evento_tipo: Mapped[str] = mapped_column(String(60), nullable=False)
    recurso_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    estudio_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    assinatura_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    processado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    dados: Mapped[dict | None] = mapped_column("payload_json", JSON, nullable=True)
    # P0-06 — vínculo opcional ao pagamento local reconciliado.
    pagamento_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
    x_request_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Cobranca(Base, UUIDMixin, TimestampMixin):
    """Cobrança local — criada ANTES de chamar o gateway (P0-06).

    `external_reference` e `idempotency_key` usam o id local (nunca o estudio_id),
    evitando vazar o tenant e colapsar checkouts distintos. A assinatura só é
    ativada após reconciliação do pagamento contra o gateway.
    """

    __tablename__ = "cobrancas"

    estudio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("estudios.id", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    plano_slug: Mapped[str] = mapped_column(String(40), nullable=False)
    ciclo: Mapped[str] = mapped_column(String(20), nullable=False)
    valor_centavos: Mapped[int] = mapped_column(Integer, nullable=False)
    moeda: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    status: Mapped[StatusCobranca] = mapped_column(
        Enum(StatusCobranca, name="status_cobranca"),
        default=StatusCobranca.CRIADA, nullable=False
    )
    gateway: Mapped[str] = mapped_column(String(40), nullable=False, default="mercadopago")
    gateway_preference_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    gateway_preapproval_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    external_reference: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    init_point: Mapped[str | None] = mapped_column(String(500), nullable=True)
    expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_usuario_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    # Guarda de entrega única do comprovante. A aprovação chega por 3 caminhos
    # (webhook payment, webhook preapproval e /reconciliar) que podem correr em
    # paralelo; o UPDATE condicional em `marcar_comprovante_enviado` garante que
    # só um deles envia o e-mail — e, futuramente, emite a nota fiscal.
    comprovante_enviado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Pagamento(Base, UUIDMixin, TimestampMixin):
    """Pagamento reconciliado a partir do gateway (P0-06). Sem dados de cartão."""

    __tablename__ = "pagamentos"

    estudio_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    cobranca_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("cobrancas.id"), nullable=True, index=True
    )
    gateway: Mapped[str] = mapped_column(String(40), nullable=False, default="mercadopago")
    gateway_payment_id: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    status: Mapped[StatusPagamento] = mapped_column(
        Enum(StatusPagamento, name="status_pagamento"), nullable=False
    )
    payment_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    payment_method_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    valor_centavos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    moeda: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    pago_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reconciliado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload_minimo_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
