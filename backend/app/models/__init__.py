"""Importa todos os models para o Alembic detectar automaticamente."""

from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.models.cliente import Cliente
from app.models.atendimento import (
    Atendimento, FormaPagamento, StatusFinanceiro, StatusOperacional, TipoAtendimento,
)
from app.models.portfolio import Portfolio, FlashArt, VisibilidadePortfolio, StatusFlash
from app.models.financeiro import Lancamento, EstoqueItem, TipoLancamento
from app.models.documento import Documento, TipoDocumento

__all__ = [
    "Estudio",
    "Usuario",
    "TipoUsuario",
    "Cliente",
    "Atendimento",
    "StatusOperacional",
    "StatusFinanceiro",
    "TipoAtendimento",
    "FormaPagamento",
]
