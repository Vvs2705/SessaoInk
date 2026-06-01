"""audit_logs

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-01 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: str | None = 'b2c3d4e5f6a7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQL puro — idempotente (CREATE ... IF NOT EXISTS)
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id               UUID        NOT NULL DEFAULT gen_random_uuid(),
            estudio_id       UUID,
            actor_usuario_id UUID,
            actor_tipo       VARCHAR(20),
            acao             VARCHAR(80) NOT NULL,
            entidade         VARCHAR(80),
            entidade_id      VARCHAR(80),
            ip               VARCHAR(64),
            user_agent       VARCHAR(500),
            metadata_json    JSONB,
            created_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_estudio_id ON audit_logs (estudio_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_acao       ON audit_logs (acao)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_em ON audit_logs (created_em)")
    # Índice composto para consulta administrativa por estúdio ordenada no tempo
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_estudio_created "
        "ON audit_logs (estudio_id, created_em DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS audit_logs")
