"""documento_links_acesso

Revision ID: a1b2c3d4e5f6
Revises: 405a9f3cc908
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7c3e1d8ab012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adicionar campo nome_assinante à tabela documentos
    op.add_column('documentos', sa.Column('nome_assinante', sa.String(200), nullable=True))

    # Criar enum acao_link
    op.execute("CREATE TYPE acao_link AS ENUM ('VISUALIZAR', 'ASSINAR')")

    # Criar tabela documento_links_acesso
    op.create_table(
        'documento_links_acesso',
        sa.Column('documento_id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('acao', sa.Enum('VISUALIZAR', 'ASSINAR', name='acao_link', create_type=False), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('usado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revogado', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('ip_geracao', sa.String(length=45), nullable=True),
        sa.Column('ip_uso', sa.String(length=45), nullable=True),
        sa.Column('user_agent_uso', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_documento_links_acesso_id'), 'documento_links_acesso', ['id'], unique=False)
    op.create_index(op.f('ix_documento_links_acesso_documento_id'), 'documento_links_acesso', ['documento_id'], unique=False)
    op.create_index(op.f('ix_documento_links_acesso_token_hash'), 'documento_links_acesso', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_documento_links_acesso_token_hash'), table_name='documento_links_acesso')
    op.drop_index(op.f('ix_documento_links_acesso_documento_id'), table_name='documento_links_acesso')
    op.drop_index(op.f('ix_documento_links_acesso_id'), table_name='documento_links_acesso')
    op.drop_table('documento_links_acesso')
    op.execute("DROP TYPE IF EXISTS acao_link")
    op.drop_column('documentos', 'nome_assinante')
