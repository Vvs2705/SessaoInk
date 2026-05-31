"""estudio_email_notificacao

Revision ID: 7c3e1d8ab012
Revises: 405a9f3cc908
Create Date: 2026-05-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c3e1d8ab012'
down_revision: Union[str, None] = '405a9f3cc908'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'estudios',
        sa.Column('email_notificacao', sa.String(length=320), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('estudios', 'email_notificacao')
