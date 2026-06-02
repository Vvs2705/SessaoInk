"""pagamentos_mp — colunas de gateway em assinaturas + inbox de eventos

- assinaturas: gateway, ciclo (expand-safe, nullable).
- pagamento_eventos: inbox de notificações de gateway com dedup
  (gateway, evento_tipo, recurso_id) para idempotência de webhook.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-06-02 14:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd9e0f1a2b3c4'
down_revision: str | None = 'c8d9e0f1a2b3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("assinaturas", sa.Column("gateway", sa.String(length=40), nullable=True))
    op.add_column("assinaturas", sa.Column("ciclo", sa.String(length=20), nullable=True))

    op.create_table(
        "pagamento_eventos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("gateway", sa.String(length=40), nullable=False),
        sa.Column("evento_tipo", sa.String(length=60), nullable=False),
        sa.Column("recurso_id", sa.String(length=120), nullable=False),
        sa.Column("estudio_id", sa.Uuid(), nullable=True),
        sa.Column("assinatura_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("processado", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("payload_json", sa.JSON(), nullable=True),
        sa.Column(
            "criado_em",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "gateway", "evento_tipo", "recurso_id", name="uq_pagamento_evento_dedup"
        ),
    )
    op.create_index(
        op.f("ix_pagamento_eventos_recurso_id"), "pagamento_eventos", ["recurso_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pagamento_eventos_recurso_id"), table_name="pagamento_eventos")
    op.drop_table("pagamento_eventos")
    op.drop_column("assinaturas", "ciclo")
    op.drop_column("assinaturas", "gateway")
