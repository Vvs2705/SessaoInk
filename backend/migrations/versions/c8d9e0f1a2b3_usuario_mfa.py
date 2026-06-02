"""usuario_mfa — colunas de MFA (TOTP + e-mail OTP) em usuarios

Adiciona mfa_totp_secret, mfa_totp_ativo, mfa_email_ativo. Todas seguras sobre
dados existentes (nullable ou server_default false).

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-06-02 13:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c8d9e0f1a2b3'
down_revision: str | None = 'b7c8d9e0f1a2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usuarios", sa.Column("mfa_totp_secret", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "usuarios",
        sa.Column(
            "mfa_totp_ativo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "usuarios",
        sa.Column(
            "mfa_email_ativo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "mfa_email_ativo")
    op.drop_column("usuarios", "mfa_totp_ativo")
    op.drop_column("usuarios", "mfa_totp_secret")
