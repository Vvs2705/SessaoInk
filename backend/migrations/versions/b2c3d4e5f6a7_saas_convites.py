"""saas_convites

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    tabelas = inspector.get_table_names()

    # Criar enums — idempotentes
    op.execute("""
        DO $$ BEGIN CREATE TYPE status_plano AS ENUM ('ATIVO', 'INATIVO');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN CREATE TYPE status_assinatura AS ENUM ('TRIAL','ATIVA','INADIMPLENTE','CANCELADA','SUSPENSA');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
        DO $$ BEGIN CREATE TYPE status_convite AS ENUM ('PENDENTE','ACEITO','EXPIRADO','REVOGADO');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)

    # Tabela planos
    if 'planos' not in tabelas:
        op.create_table(
            'planos',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('nome', sa.String(length=100), nullable=False),
            sa.Column('descricao', sa.String(length=500), nullable=True),
            sa.Column('status', sa.Enum('ATIVO', 'INATIVO', name='status_plano', create_type=False), nullable=False),
            sa.Column('preco_mensal', sa.Float(), nullable=True),
            sa.Column('limites', sa.JSON(), nullable=True),
            sa.Column('externo_id', sa.String(length=200), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_planos_id', 'planos', ['id'], unique=False)

    # Tabela assinaturas
    if 'assinaturas' not in tabelas:
        op.create_table(
            'assinaturas',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('estudio_id', sa.UUID(), nullable=False),
            sa.Column('plano_id', sa.UUID(), nullable=True),
            sa.Column('status', sa.Enum('TRIAL','ATIVA','INADIMPLENTE','CANCELADA','SUSPENSA', name='status_assinatura', create_type=False), nullable=False),
            sa.Column('trial_expira_em', sa.DateTime(timezone=True), nullable=True),
            sa.Column('periodo_inicio', sa.DateTime(timezone=True), nullable=True),
            sa.Column('periodo_fim', sa.DateTime(timezone=True), nullable=True),
            sa.Column('cancelar_no_fim', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('externo_id', sa.String(length=200), nullable=True),
            sa.Column('externo_customer_id', sa.String(length=200), nullable=True),
            sa.ForeignKeyConstraint(['estudio_id'], ['estudios.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['plano_id'], ['planos.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('estudio_id'),
        )
        op.create_index('ix_assinaturas_id', 'assinaturas', ['id'], unique=False)
        op.create_index('ix_assinaturas_estudio_id', 'assinaturas', ['estudio_id'], unique=True)

    # Tabela convites
    if 'convites' not in tabelas:
        op.create_table(
            'convites',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('estudio_id', sa.UUID(), nullable=False),
            sa.Column('email', sa.String(length=320), nullable=False),
            sa.Column('role', sa.Enum('ADMIN','ARTISTA','RECEPCIONISTA', name='tipo_usuario', create_type=False), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('status', sa.Enum('PENDENTE','ACEITO','EXPIRADO','REVOGADO', name='status_convite', create_type=False), nullable=False),
            sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
            sa.Column('aceito_em', sa.DateTime(timezone=True), nullable=True),
            sa.Column('convidado_por_id', sa.UUID(), nullable=True),
            sa.ForeignKeyConstraint(['convidado_por_id'], ['usuarios.id']),
            sa.ForeignKeyConstraint(['estudio_id'], ['estudios.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token_hash'),
        )
        op.create_index('ix_convites_id', 'convites', ['id'], unique=False)
        op.create_index('ix_convites_estudio_id', 'convites', ['estudio_id'], unique=False)
        op.create_index('ix_convites_email', 'convites', ['email'], unique=False)
        op.create_index('ix_convites_token_hash', 'convites', ['token_hash'], unique=True)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS convites")
    op.execute("DROP TABLE IF EXISTS assinaturas")
    op.execute("DROP TABLE IF EXISTS planos")
    op.execute("DROP TYPE IF EXISTS status_convite")
    op.execute("DROP TYPE IF EXISTS status_assinatura")
    op.execute("DROP TYPE IF EXISTS status_plano")
