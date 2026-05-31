"""documento_links_acesso

Revision ID: a1b2c3d4e5f6
Revises: 7c3e1d8ab012
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7c3e1d8ab012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Todas as operações em SQL puro para ser 100% idempotente
    # (SQLAlchemy _on_table_create ignora create_type=False e tenta recriar enums)

    op.execute("ALTER TABLE documentos ADD COLUMN IF NOT EXISTS nome_assinante VARCHAR(200)")

    op.execute("""
        DO $$ BEGIN
            CREATE TYPE acao_link AS ENUM ('VISUALIZAR', 'ASSINAR');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS documento_links_acesso (
            id          UUID        NOT NULL DEFAULT gen_random_uuid(),
            documento_id UUID       NOT NULL,
            token_hash  VARCHAR(64) NOT NULL,
            acao        acao_link   NOT NULL,
            expira_em   TIMESTAMPTZ NOT NULL,
            usado_em    TIMESTAMPTZ,
            revogado    BOOLEAN     NOT NULL DEFAULT false,
            ip_geracao  VARCHAR(45),
            ip_uso      VARCHAR(45),
            user_agent_uso VARCHAR(500),
            criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_doc_link_documento
                FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_documento_links_acesso_id           ON documento_links_acesso (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documento_links_acesso_documento_id  ON documento_links_acesso (documento_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_documento_links_acesso_token_hash ON documento_links_acesso (token_hash)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS documento_links_acesso")
    op.execute("DROP TYPE IF EXISTS acao_link")
    op.execute("ALTER TABLE documentos DROP COLUMN IF EXISTS nome_assinante")
