"""agenda_orcamento_disponibilidade

Horário de funcionamento + feed ICS no estúdio; preferências de data do
cliente no atendimento (orçamento público).

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-06-10 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: str | None = "f2a3b4c5d6e7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "estudios",
        sa.Column("horario_funcionamento", sa.JSON(), nullable=True),
    )
    op.add_column(
        "estudios",
        sa.Column("agenda_ics_token", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_estudios_agenda_ics_token",
        "estudios",
        ["agenda_ics_token"],
    )
    op.add_column(
        "atendimentos",
        sa.Column("datas_preferidas", sa.JSON(), nullable=True),
    )
    op.add_column(
        "atendimentos",
        sa.Column("horario_personalizado", sa.String(length=300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("atendimentos", "horario_personalizado")
    op.drop_column("atendimentos", "datas_preferidas")
    op.drop_index("ix_estudios_agenda_ics_token", table_name="estudios")
    op.drop_column("estudios", "agenda_ics_token")
    op.drop_column("estudios", "horario_funcionamento")
