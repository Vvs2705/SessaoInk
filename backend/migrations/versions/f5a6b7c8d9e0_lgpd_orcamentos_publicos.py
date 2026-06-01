"""lgpd_orcamentos_publicos

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-01 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5a6b7c8d9e0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE atendimentos
        ADD COLUMN IF NOT EXISTS orcamento_publico BOOLEAN NOT NULL DEFAULT false
    """)
    op.execute("""
        ALTER TABLE atendimentos
        ADD COLUMN IF NOT EXISTS lgpd_retencao_ate TIMESTAMPTZ
    """)
    op.execute("""
        ALTER TABLE atendimentos
        ADD COLUMN IF NOT EXISTS lgpd_anonimizado_em TIMESTAMPTZ
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS consentimentos (
            id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
            estudio_id          UUID        NOT NULL,
            atendimento_id      UUID,
            origem              VARCHAR(60) NOT NULL,
            aceite_privacidade  BOOLEAN     NOT NULL,
            aceite_termos       BOOLEAN     NOT NULL,
            versao_privacidade  VARCHAR(40) NOT NULL,
            versao_termos       VARCHAR(40) NOT NULL,
            ip_hash             VARCHAR(64),
            user_agent_hash     VARCHAR(64),
            criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
            atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_consentimentos_estudios
                FOREIGN KEY (estudio_id) REFERENCES estudios(id) ON DELETE RESTRICT,
            CONSTRAINT fk_consentimentos_atendimentos
                FOREIGN KEY (atendimento_id) REFERENCES atendimentos(id) ON DELETE SET NULL
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_atendimentos_lgpd_publico_retencao
        ON atendimentos (orcamento_publico, lgpd_retencao_ate, lgpd_anonimizado_em)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_consentimentos_estudio_id
        ON consentimentos (estudio_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_consentimentos_atendimento_id
        ON consentimentos (atendimento_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_consentimentos_origem
        ON consentimentos (origem)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_consentimentos_origem")
    op.execute("DROP INDEX IF EXISTS ix_consentimentos_atendimento_id")
    op.execute("DROP INDEX IF EXISTS ix_consentimentos_estudio_id")
    op.execute("DROP INDEX IF EXISTS ix_atendimentos_lgpd_publico_retencao")
    op.execute("DROP TABLE IF EXISTS consentimentos")
    op.execute("ALTER TABLE atendimentos DROP COLUMN IF EXISTS lgpd_anonimizado_em")
    op.execute("ALTER TABLE atendimentos DROP COLUMN IF EXISTS lgpd_retencao_ate")
    op.execute("ALTER TABLE atendimentos DROP COLUMN IF EXISTS orcamento_publico")
