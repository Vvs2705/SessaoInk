"""compound_indexes_perf

Revision ID: e4f5a6b7c8d9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-01 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQL puro e idempotente: otimiza os padrões multi-tenant mais frequentes
    # sem alterar models nem fluxo de aplicação.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_clientes_estudio_ativo_nome
        ON clientes (estudio_id, ativo, nome)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_usuarios_estudio_ativo_email
        ON usuarios (estudio_id, ativo, email)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_atendimentos_estudio_ativo_criado
        ON atendimentos (estudio_id, ativo, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_atendimentos_estudio_ativo_status_criado
        ON atendimentos (estudio_id, ativo, status_operacional, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_atendimentos_estudio_ativo_data_sessao
        ON atendimentos (estudio_id, ativo, data_sessao)
        WHERE data_sessao IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_atendimentos_estudio_artista_status_data
        ON atendimentos (estudio_id, artista_id, ativo, status_operacional, data_sessao)
        WHERE data_sessao IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_estudio_criado
        ON lancamentos (estudio_id, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_lancamentos_estudio_status_tipo_realizada
        ON lancamentos (estudio_id, status, tipo, data_realizada)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_documentos_estudio_criado
        ON documentos (estudio_id, criado_em DESC)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_portfolio_estudio_ativo_criado
        ON portfolio (estudio_id, ativo, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_portfolio_publico_estudio_criado
        ON portfolio (estudio_id, visibilidade, autorizado_publicacao, ativo, criado_em DESC)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_flash_arts_estudio_ativo_criado
        ON flash_arts (estudio_id, ativo, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_flash_arts_estudio_status_ativo_criado
        ON flash_arts (estudio_id, status, ativo, criado_em DESC)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_estoque_itens_estudio_ativo_nome
        ON estoque_itens (estudio_id, ativo, nome)
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_convites_estudio_criado
        ON convites (estudio_id, criado_em DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_convites_estudio_email_status
        ON convites (estudio_id, email, status)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_convites_estudio_email_status")
    op.execute("DROP INDEX IF EXISTS ix_convites_estudio_criado")
    op.execute("DROP INDEX IF EXISTS ix_estoque_itens_estudio_ativo_nome")
    op.execute("DROP INDEX IF EXISTS ix_flash_arts_estudio_status_ativo_criado")
    op.execute("DROP INDEX IF EXISTS ix_flash_arts_estudio_ativo_criado")
    op.execute("DROP INDEX IF EXISTS ix_portfolio_publico_estudio_criado")
    op.execute("DROP INDEX IF EXISTS ix_portfolio_estudio_ativo_criado")
    op.execute("DROP INDEX IF EXISTS ix_documentos_estudio_criado")
    op.execute("DROP INDEX IF EXISTS ix_lancamentos_estudio_status_tipo_realizada")
    op.execute("DROP INDEX IF EXISTS ix_lancamentos_estudio_criado")
    op.execute("DROP INDEX IF EXISTS ix_atendimentos_estudio_artista_status_data")
    op.execute("DROP INDEX IF EXISTS ix_atendimentos_estudio_ativo_data_sessao")
    op.execute("DROP INDEX IF EXISTS ix_atendimentos_estudio_ativo_status_criado")
    op.execute("DROP INDEX IF EXISTS ix_atendimentos_estudio_ativo_criado")
    op.execute("DROP INDEX IF EXISTS ix_usuarios_estudio_ativo_email")
    op.execute("DROP INDEX IF EXISTS ix_clientes_estudio_ativo_nome")
