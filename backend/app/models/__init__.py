"""Importa todos os models para o Alembic detectar automaticamente."""

from app.models.atendimento import (  # noqa: F401
    Atendimento,
    FormaPagamento,
    StatusFinanceiro,
    StatusOperacional,
    TipoAtendimento,
)
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.cliente import Cliente  # noqa: F401
from app.models.convite import Convite, StatusConvite  # noqa: F401
from app.models.documento import (  # noqa: F401
    AcaoLink,
    Documento,
    DocumentoLinkAcesso,
    TipoDocumento,
)
from app.models.financeiro import EstoqueItem, Lancamento, TipoLancamento  # noqa: F401
from app.models.portfolio import (  # noqa: F401
    FlashArt,
    Portfolio,
    StatusFlash,
    VisibilidadePortfolio,
)
from app.models.saas import (  # noqa: F401
    Assinatura,
    Plano,
    StatusAssinatura,
    StatusPlano,
)
from app.models.usuario import Estudio, TipoUsuario, Usuario  # noqa: F401

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
    "AuditLog",
]
