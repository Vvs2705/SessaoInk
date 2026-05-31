"""saas_convites

Revision ID: b2c3d4e5f6a7
Revises: 405a9f3cc908
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    status_plano = sa.Enum('ATIVO', 'INATIVO', name='status_plano')
    status_assinatura = sa.Enum(
        'TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'SUSPENSA',
        name='status_assinatura',
    )
    status_convite = sa.Enum(
        'PENDENTE', 'ACEITO', 'EXPIRADO', 'REVOGADO',
        name='status_convite',
    )
    status_plano.create(op.get_bind(), checkfirst=True)
    status_assinatura.create(op.get_bind(), checkfirst=True)
    status_convite.create(op.get_bind(), checkfirst=True)

    # Tabela planos
    op.create_table(
        'planos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('descricao', sa.String(length=500), nullable=True),
        sa.Column('status', sa.Enum('ATIVO', 'INATIVO', name='status_plano'), nullable=False),
        sa.Column('preco_mensal', sa.Float(), nullable=True),
        sa.Column('limites', sa.JSON(), nullable=True),
        sa.Column('externo_id', sa.String(length=200), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_planos_id'), 'planos', ['id'], unique=False)

    # Tabela assinaturas
    op.create_table(
        'assinaturas',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('estudio_id', sa.UUID(), nullable=False),
        sa.Column('plano_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.Enum('TRIAL', 'ATIVA', 'INADIMPLENTE', 'CANCELADA', 'SUSPENSA', name='status_assinatura'), nullable=False),
        sa.Column('trial_expira_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('periodo_inicio', sa.DateTime(timezone=True), nullable=True),
        sa.Column('periodo_fim', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelar_no_fim', sa.Boolean(), nullable=False),
        sa.Column('externo_id', sa.String(length=200), nullable=True),
        sa.Column('externo_customer_id', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['estudio_id'], ['estudios.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['plano_id'], ['planos.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('estudio_id'),
    )
    op.create_index(op.f('ix_assinaturas_id'), 'assinaturas', ['id'], unique=False)
    op.create_index(op.f('ix_assinaturas_estudio_id'), 'assinaturas', ['estudio_id'], unique=True)

    # Tabela convites
    op.create_table(
        'convites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('estudio_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('role', sa.Enum('ADMIN', 'ARTISTA', 'RECEPCIONISTA', name='tipo_usuario'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('status', sa.Enum('PENDENTE', 'ACEITO', 'EXPIRADO', 'REVOGADO', name='status_convite'), nullable=False),
        sa.Column('expira_em', sa.DateTime(timezone=True), nullable=False),
        sa.Column('aceito_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('convidado_por_id', sa.UUID(), nullable=True),
        sa.ForeignKeyConstraint(['convidado_por_id'], ['usuarios.id']),
        sa.ForeignKeyConstraint(['estudio_id'], ['estudios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index(op.f('ix_convites_id'), 'convites', ['id'], unique=False)
    op.create_index(op.f('ix_convites_estudio_id'), 'convites', ['estudio_id'], unique=False)
    op.create_index(op.f('ix_convites_email'), 'convites', ['email'], unique=False)
    op.create_index(op.f('ix_convites_token_hash'), 'convites', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_convites_token_hash'), table_name='convites')
    op.drop_index(op.f('ix_convites_email'), table_name='convites')
    op.drop_index(op.f('ix_convites_estudio_id'), table_name='convites')
    op.drop_index(op.f('ix_convites_id'), table_name='convites')
    op.drop_table('convites')

    op.drop_index(op.f('ix_assinaturas_estudio_id'), table_name='assinaturas')
    op.drop_index(op.f('ix_assinaturas_id'), table_name='assinaturas')
    op.drop_table('assinaturas')

    op.drop_index(op.f('ix_planos_id'), table_name='planos')
    op.drop_table('planos')

    sa.Enum(name='status_convite').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='status_assinatura').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='status_plano').drop(op.get_bind(), checkfirst=True)
