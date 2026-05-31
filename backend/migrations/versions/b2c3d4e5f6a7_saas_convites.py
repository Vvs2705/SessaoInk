"""saas_convites

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQL puro — 100% idempotente, sem interferência do SQLAlchemy _on_table_create

    op.execute("""
        DO $$ BEGIN CREATE TYPE status_plano AS ENUM ('ATIVO','INATIVO');
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

    op.execute("""
        CREATE TABLE IF NOT EXISTS planos (
            id           UUID         NOT NULL DEFAULT gen_random_uuid(),
            nome         VARCHAR(100) NOT NULL,
            descricao    VARCHAR(500),
            status       status_plano NOT NULL DEFAULT 'ATIVO',
            preco_mensal FLOAT,
            limites      JSONB,
            externo_id   VARCHAR(200),
            criado_em    TIMESTAMPTZ  NOT NULL DEFAULT now(),
            atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_planos_id ON planos (id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS assinaturas (
            id                   UUID              NOT NULL DEFAULT gen_random_uuid(),
            estudio_id           UUID              NOT NULL UNIQUE,
            plano_id             UUID,
            status               status_assinatura NOT NULL DEFAULT 'TRIAL',
            trial_expira_em      TIMESTAMPTZ,
            periodo_inicio       TIMESTAMPTZ,
            periodo_fim          TIMESTAMPTZ,
            cancelar_no_fim      BOOLEAN NOT NULL DEFAULT false,
            externo_id           VARCHAR(200),
            externo_customer_id  VARCHAR(200),
            criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
            atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_assinatura_estudio FOREIGN KEY (estudio_id) REFERENCES estudios(id) ON DELETE RESTRICT,
            CONSTRAINT fk_assinatura_plano   FOREIGN KEY (plano_id)   REFERENCES planos(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_assinaturas_id         ON assinaturas (id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_assinaturas_estudio_id ON assinaturas (estudio_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS convites (
            id                UUID          NOT NULL DEFAULT gen_random_uuid(),
            estudio_id        UUID          NOT NULL,
            email             VARCHAR(320)  NOT NULL,
            role              tipo_usuario  NOT NULL DEFAULT 'ARTISTA',
            token_hash        VARCHAR(64)   NOT NULL UNIQUE,
            status            status_convite NOT NULL DEFAULT 'PENDENTE',
            expira_em         TIMESTAMPTZ   NOT NULL,
            aceito_em         TIMESTAMPTZ,
            convidado_por_id  UUID,
            criado_em         TIMESTAMPTZ   NOT NULL DEFAULT now(),
            atualizado_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
            PRIMARY KEY (id),
            CONSTRAINT fk_convite_estudio       FOREIGN KEY (estudio_id)       REFERENCES estudios(id) ON DELETE CASCADE,
            CONSTRAINT fk_convite_convidado_por FOREIGN KEY (convidado_por_id) REFERENCES usuarios(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_convites_id          ON convites (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_convites_estudio_id  ON convites (estudio_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_convites_email       ON convites (email)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_convites_token_hash ON convites (token_hash)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS convites")
    op.execute("DROP TABLE IF EXISTS assinaturas")
    op.execute("DROP TABLE IF EXISTS planos")
    op.execute("DROP TYPE IF EXISTS status_convite")
    op.execute("DROP TYPE IF EXISTS status_assinatura")
    op.execute("DROP TYPE IF EXISTS status_plano")
