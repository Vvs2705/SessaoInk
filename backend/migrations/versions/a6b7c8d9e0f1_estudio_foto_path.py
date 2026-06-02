"""estudio_foto_path

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-06-02 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a6b7c8d9e0f1'
down_revision: str | None = 'f5a6b7c8d9e0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'estudios',
        sa.Column('foto_path', sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('estudios', 'foto_path')
