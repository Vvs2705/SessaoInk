"""cobranca_pagamento_local — modelo local de cobrança/pagamento (P0-06)

- cobrancas: cobrança criada ANTES do gateway; external_reference/idempotency_key
  usam o id local (não o estudio_id).
- pagamentos: pagamento reconciliado a partir do gateway (sem dados de cartão).
- pagamento_eventos: +pagamento_id, +x_request_id (rastreio do webhook).

Tudo aditivo. Nenhuma tabela existente é alterada de forma destrutiva.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-04 18:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: str | None = "e1f2a3b4c5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STATUS_COBRANCA = sa.Enum(
    "CRIADA", "ENVIADA_GATEWAY", "PENDENTE", "PAGA", "EXPIRADA", "CANCELADA", "FALHA",
    name="status_cobranca",
)
_STATUS_PAGAMENTO = sa.Enum(
    "PENDING", "APPROVED", "AUTHORIZED", "IN_PROCESS", "REJECTED", "REFUNDED",
    "CHARGED_BACK", "CANCELLED",
    name="status_pagamento",
)


def upgrade() -> None:
    # Rastreio extra no inbox de eventos.
    op.add_column("pagamento_eventos", sa.Column("pagamento_id", sa.Uuid(), nullable=True))
    op.add_column(
        "pagamento_eventos", sa.Column("x_request_id", sa.String(length=120), nullable=True)
    )

    op.create_table(
        "cobrancas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("estudio_id", sa.Uuid(), nullable=False),
        sa.Column("plano_slug", sa.String(length=40), nullable=False),
        sa.Column("ciclo", sa.String(length=20), nullable=False),
        sa.Column("valor_centavos", sa.Integer(), nullable=False),
        sa.Column("moeda", sa.String(length=3), nullable=False, server_default="BRL"),
        sa.Column("status", _STATUS_COBRANCA, nullable=False, server_default="CRIADA"),
        sa.Column("gateway", sa.String(length=40), nullable=False, server_default="mercadopago"),
        sa.Column("gateway_preference_id", sa.String(length=200), nullable=True),
        sa.Column("gateway_preapproval_id", sa.String(length=200), nullable=True),
        sa.Column("external_reference", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("init_point", sa.String(length=500), nullable=True),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_usuario_id", sa.Uuid(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["estudio_id"], ["estudios.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("external_reference", name="uq_cobrancas_external_reference"),
    )
    op.create_index(op.f("ix_cobrancas_estudio_id"), "cobrancas", ["estudio_id"])
    op.create_index(op.f("ix_cobrancas_external_reference"), "cobrancas", ["external_reference"])

    op.create_table(
        "pagamentos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("estudio_id", sa.Uuid(), nullable=False),
        sa.Column("cobranca_id", sa.Uuid(), nullable=True),
        sa.Column("gateway", sa.String(length=40), nullable=False, server_default="mercadopago"),
        sa.Column("gateway_payment_id", sa.String(length=120), nullable=False),
        sa.Column("status", _STATUS_PAGAMENTO, nullable=False),
        sa.Column("payment_type", sa.String(length=40), nullable=True),
        sa.Column("payment_method_id", sa.String(length=40), nullable=True),
        sa.Column("valor_centavos", sa.Integer(), nullable=True),
        sa.Column("moeda", sa.String(length=3), nullable=False, server_default="BRL"),
        sa.Column("pago_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reconciliado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payload_minimo_json", sa.JSON(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["cobranca_id"], ["cobrancas.id"]),
        sa.UniqueConstraint("gateway_payment_id", name="uq_pagamentos_gateway_payment_id"),
    )
    op.create_index(op.f("ix_pagamentos_estudio_id"), "pagamentos", ["estudio_id"])
    op.create_index(op.f("ix_pagamentos_cobranca_id"), "pagamentos", ["cobranca_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_pagamentos_cobranca_id"), table_name="pagamentos")
    op.drop_index(op.f("ix_pagamentos_estudio_id"), table_name="pagamentos")
    op.drop_table("pagamentos")
    op.drop_index(op.f("ix_cobrancas_external_reference"), table_name="cobrancas")
    op.drop_index(op.f("ix_cobrancas_estudio_id"), table_name="cobrancas")
    op.drop_table("cobrancas")
    op.drop_column("pagamento_eventos", "x_request_id")
    op.drop_column("pagamento_eventos", "pagamento_id")
    sa.Enum(name="status_pagamento").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="status_cobranca").drop(op.get_bind(), checkfirst=True)
