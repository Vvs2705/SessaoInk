"""documento_links_acesso

Revision ID: a1b2c3d4e5f6
Revises: 7c3e1d8ab012
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7c3e1d8ab012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa_inspect(conn)

    # 1. Adicionar nome_assinante — idempotente via IF NOT EXISTS
    op.execute("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS nome_assinante VARCHAR(200)")

    # 2. Criar enum acao_link — idempotente via bloco DO/EXCEPTION
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE acao_link AS ENUM ('VISUALIZAR', 'ASSINAR');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # 3. Criar tabela documento_links_acesso — só se não existir
    tabelas = inspector.get_table_names()
    if 'documento_links_acesso' not in tabelas:
        op.create_table(
            'documento_links_acesso',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('documento_id', sa.UUID(), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('acao', sa.Enum('VISUALIZAR', 'ASSINAR', name='acao_link', create_type=False), nullable=False),
            sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
            sa.Column('usado_em', sa.DateTime(timezone=True), nullable=True),
            sa.Column('revogado', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('ip_geracao', sa.String(length=45), nullable=True),
            sa.Column('ip_uso', sa.String(length=45), nullable=True),
            sa.Column('user_agent_uso', sa.String(length=500), nullable=True),
            sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_documento_links_acesso_id', 'documento_links_acesso', ['id'], unique=False)
        op.create_index('ix_documento_links_acesso_documento_id', 'documento_links_acesso', ['documento_id'], unique=False)
        op.create_index('ix_documento_links_acesso_token_hash', 'documento_links_acesso', ['token_hash'], unique=True)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documento_links_acesso_token_hash")
    op.execute("DROP INDEX IF EXISTS ix_documento_links_acesso_documento_id")
    op.execute("DROP INDEX IF EXISTS ix_documento_links_acesso_id")
    op.execute("DROP TABLE IF EXISTS documento_links_acesso")
    op.execute("DROP TYPE IF EXISTS acao_link")
    op.execute("ALTER TABLE documentos DROP COLUMN IF EXISTS nome_assinante")
