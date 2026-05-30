"""atendimento_imagens

Revision ID: 405a9f3cc908
Revises: 203f9f3bb806
Create Date: 2026-05-30 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '405a9f3cc908'
down_revision: Union[str, None] = '203f9f3bb806'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'atendimento_imagens',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=False),
        sa.Column('atendimento_id', sa.UUID(), nullable=False),
        sa.Column('imagem_path', sa.String(length=500), nullable=False),
        sa.ForeignKeyConstraint(['atendimento_id'], ['atendimentos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_atendimento_imagens_atendimento_id'), 'atendimento_imagens', ['atendimento_id'], unique=False)
    op.create_index(op.f('ix_atendimento_imagens_id'), 'atendimento_imagens', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_atendimento_imagens_id'), table_name='atendimento_imagens')
    op.drop_index(op.f('ix_atendimento_imagens_atendimento_id'), table_name='atendimento_imagens')
    op.drop_table('atendimento_imagens')
