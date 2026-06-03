"""add_endereco_estudio

Revision ID: e1f2a3b4c5d6
Revises: e0f1a2b3c4d5
Create Date: 2026-06-03
"""

import sqlalchemy as sa
from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estudios", sa.Column("endereco_cep", sa.String(length=12), nullable=True))
    op.add_column("estudios", sa.Column("endereco_logradouro", sa.String(length=180), nullable=True))
    op.add_column("estudios", sa.Column("endereco_numero", sa.String(length=30), nullable=True))
    op.add_column("estudios", sa.Column("endereco_complemento", sa.String(length=120), nullable=True))
    op.add_column("estudios", sa.Column("endereco_bairro", sa.String(length=120), nullable=True))
    op.add_column("estudios", sa.Column("endereco_cidade", sa.String(length=100), nullable=True))
    op.add_column("estudios", sa.Column("endereco_uf", sa.String(length=2), nullable=True))
    op.add_column("estudios", sa.Column("endereco_pais", sa.String(length=80), nullable=True, server_default="Brasil"))
    op.add_column("estudios", sa.Column("google_negocio_url", sa.String(length=600), nullable=True))
    op.add_column("estudios", sa.Column("latitude", sa.String(length=40), nullable=True))
    op.add_column("estudios", sa.Column("longitude", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("estudios", "longitude")
    op.drop_column("estudios", "latitude")
    op.drop_column("estudios", "google_negocio_url")
    op.drop_column("estudios", "endereco_pais")
    op.drop_column("estudios", "endereco_uf")
    op.drop_column("estudios", "endereco_cidade")
    op.drop_column("estudios", "endereco_bairro")
    op.drop_column("estudios", "endereco_complemento")
    op.drop_column("estudios", "endereco_numero")
    op.drop_column("estudios", "endereco_logradouro")
    op.drop_column("estudios", "endereco_cep")
