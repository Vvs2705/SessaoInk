"""financeiro_track_b — expansão do modelo de lançamentos (Track B)

Adiciona classificação contábil (categoria, centro_custo, origem), decomposição
de valor (bruto/taxa/líquido), datas contábeis (competência, vencimento),
comissão (percentual + vínculo de origem), recorrência/parcelas, e auditoria de
autoria/cancelamento. Estende os enums tipo_lancamento (RESERVA/ESTORNO/AJUSTE)
e status_lancamento (PARCIAL), e cria os enums origem_lancamento e
recorrencia_lancamento.

Estratégia expand-and-contract: todas as colunas são nullable ou possuem
server_default constante (metadata-only no PG 11+), seguras sobre dados
existentes. Apenas adições — sem reescrita de tabela.

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-06-02 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: str | None = 'a6b7c8d9e0f1'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        # Estende enums nativos existentes (PG 12+ permite ADD VALUE em transação).
        op.execute("ALTER TYPE tipo_lancamento ADD VALUE IF NOT EXISTS 'RESERVA'")
        op.execute("ALTER TYPE tipo_lancamento ADD VALUE IF NOT EXISTS 'ESTORNO'")
        op.execute("ALTER TYPE tipo_lancamento ADD VALUE IF NOT EXISTS 'AJUSTE'")
        op.execute("ALTER TYPE status_lancamento ADD VALUE IF NOT EXISTS 'PARCIAL'")

    origem_enum = sa.Enum(
        "MANUAL", "ATENDIMENTO", "COMISSAO", "ASSINATURA", "SISTEMA",
        name="origem_lancamento",
    )
    recorrencia_enum = sa.Enum(
        "NENHUMA", "SEMANAL", "MENSAL", "ANUAL",
        name="recorrencia_lancamento",
    )
    if is_pg:
        origem_enum.create(bind, checkfirst=True)
        recorrencia_enum.create(bind, checkfirst=True)

    op.add_column("lancamentos", sa.Column("categoria", sa.String(length=80), nullable=True))
    op.add_column("lancamentos", sa.Column("centro_custo", sa.String(length=80), nullable=True))
    op.add_column(
        "lancamentos",
        sa.Column(
            "origem", origem_enum, nullable=False, server_default="MANUAL"
        ),
    )
    op.add_column("lancamentos", sa.Column("valor_bruto", sa.Numeric(10, 2), nullable=True))
    op.add_column("lancamentos", sa.Column("valor_taxa", sa.Numeric(10, 2), nullable=True))
    op.add_column("lancamentos", sa.Column("valor_liquido", sa.Numeric(10, 2), nullable=True))
    op.add_column("lancamentos", sa.Column("competencia", sa.Date(), nullable=True))
    op.add_column(
        "lancamentos",
        sa.Column("data_vencimento", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "lancamentos", sa.Column("comissao_percentual", sa.Numeric(5, 2), nullable=True)
    )
    op.add_column(
        "lancamentos",
        sa.Column(
            "lancamento_origem_id",
            sa.Uuid(),
            sa.ForeignKey("lancamentos.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "lancamentos",
        sa.Column(
            "recorrencia", recorrencia_enum, nullable=False, server_default="NENHUMA"
        ),
    )
    op.add_column("lancamentos", sa.Column("parcela_numero", sa.Integer(), nullable=True))
    op.add_column("lancamentos", sa.Column("parcela_total", sa.Integer(), nullable=True))
    op.add_column("lancamentos", sa.Column("grupo_id", sa.Uuid(), nullable=True))
    op.add_column(
        "lancamentos",
        sa.Column("criado_por_id", sa.Uuid(), sa.ForeignKey("usuarios.id"), nullable=True),
    )
    op.add_column(
        "lancamentos",
        sa.Column("cancelado_por_id", sa.Uuid(), sa.ForeignKey("usuarios.id"), nullable=True),
    )
    op.add_column(
        "lancamentos",
        sa.Column("cancelado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "lancamentos",
        sa.Column("motivo_cancelamento", sa.String(length=300), nullable=True),
    )

    op.create_index(op.f("ix_lancamentos_artista_id"), "lancamentos", ["artista_id"])
    op.create_index(op.f("ix_lancamentos_tipo"), "lancamentos", ["tipo"])
    op.create_index(op.f("ix_lancamentos_status"), "lancamentos", ["status"])
    op.create_index(op.f("ix_lancamentos_categoria"), "lancamentos", ["categoria"])
    op.create_index(op.f("ix_lancamentos_competencia"), "lancamentos", ["competencia"])
    op.create_index(
        op.f("ix_lancamentos_lancamento_origem_id"), "lancamentos", ["lancamento_origem_id"]
    )
    op.create_index(op.f("ix_lancamentos_grupo_id"), "lancamentos", ["grupo_id"])


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_index(op.f("ix_lancamentos_grupo_id"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_lancamento_origem_id"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_competencia"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_categoria"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_status"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_tipo"), table_name="lancamentos")
    op.drop_index(op.f("ix_lancamentos_artista_id"), table_name="lancamentos")

    for col in (
        "motivo_cancelamento",
        "cancelado_em",
        "cancelado_por_id",
        "criado_por_id",
        "grupo_id",
        "parcela_total",
        "parcela_numero",
        "recorrencia",
        "lancamento_origem_id",
        "comissao_percentual",
        "data_vencimento",
        "competencia",
        "valor_liquido",
        "valor_taxa",
        "valor_bruto",
        "origem",
        "centro_custo",
        "categoria",
    ):
        op.drop_column("lancamentos", col)

    if is_pg:
        op.execute("DROP TYPE IF EXISTS recorrencia_lancamento")
        op.execute("DROP TYPE IF EXISTS origem_lancamento")
        # Nota: valores adicionados a tipo_lancamento/status_lancamento não são
        # removíveis em PostgreSQL sem recriar o tipo; downgrade os mantém.
