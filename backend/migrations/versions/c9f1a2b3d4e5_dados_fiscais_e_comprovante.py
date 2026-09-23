"""dados fiscais do contratante + guarda de comprovante

Emitir NFS-e exige CPF/CNPJ e endereço do tomador (padrão nacional e
Caieiras/SP). O estúdio já tinha endereço; faltavam documento e razão social.

`cobrancas.comprovante_enviado_em` é a guarda de entrega única: a aprovação de
pagamento chega por 3 caminhos concorrentes (webhook payment, webhook
preapproval e /reconciliar) e sem ela o cliente receberia comprovante — e,
depois, nota fiscal — duplicado.

Aditiva e reversível: nenhuma coluna existente é alterada.

Revision ID: c9f1a2b3d4e5
Revises: a3b4c5d6e7f8
"""

import sqlalchemy as sa
from alembic import op

revision = "c9f1a2b3d4e5"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("estudios", sa.Column("documento", sa.String(length=14), nullable=True))
    op.add_column("estudios", sa.Column("razao_social", sa.String(length=200), nullable=True))
    op.add_column(
        "cobrancas",
        sa.Column("comprovante_enviado_em", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cobrancas", "comprovante_enviado_em")
    op.drop_column("estudios", "razao_social")
    op.drop_column("estudios", "documento")
