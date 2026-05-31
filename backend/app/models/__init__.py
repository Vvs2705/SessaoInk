"""Importa todos os models para o Alembic detectar automaticamente."""

from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.models.cliente import Cliente
from app.models.atendimento import (
    Atendimento, FormaPagamento, StatusFinanceiro, StatusOperacional, TipoAtendimento,
)
from app.models.portfolio import Portfolio, FlashArt, VisibilidadePortfolio, StatusFlash
from app.models.financeiro import Lancamento, EstoqueItem, TipoLancamento
from app.models.documento import Documento, TipoDocumento, DocumentoLinkAcesso, AcaoLink
from app.models.saas import Plano, Assinatura, StatusPlano, StatusAssinatura  # noqa
from app.models.convite import Convite, StatusConvite  # noqa

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
    "Plano",
    "Assinatura",
    "Convite",
]
