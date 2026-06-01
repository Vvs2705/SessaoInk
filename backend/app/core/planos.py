"""Catálogo de planos do SessãoInk (fonte única de verdade do empacotamento).

Estratégia validada (docs/planos-precificacao.md): 3 tiers, com o Profissional
como alvo de conversão (badge "Mais popular" + promoção de entrada). Os limites
alimentam o enforcement de entitlements; `recursos` alimenta a página de preços.

`None` em um limite numérico = ILIMITADO.
"""

from typing import Any

# Promoção de entrada (somente Profissional): R$100/mês nos 6 primeiros meses.
PROMO_PROFISSIONAL = {
    "preco_promocional": 100.0,
    "meses": 6,
    "descricao": "R$100/mês nos 6 primeiros meses, depois R$135/mês.",
}

TRIAL_DIAS = 14


def _recurso(label: str, incluso: bool, detalhe: str | None = None) -> dict[str, Any]:
    return {"label": label, "incluso": incluso, "detalhe": detalhe}


PLANOS: list[dict[str, Any]] = [
    {
        "slug": "essencial",
        "nome": "Essencial",
        "preco_mensal": 50.0,
        "destaque": False,
        "publico_alvo": "Tatuador autônomo começando",
        "descricao": "O essencial para organizar agenda, clientes e orçamentos.",
        "limites": {
            "usuarios": 1,
            "portfolio_fotos": 30,
            "documentos_mes": 10,
            "storage_mb": 1024,
            "financeiro": "basico",
            "flash_arts": False,
            "estoque": False,
            "relatorios": False,
            "auditoria": False,
        },
        "recursos": [
            _recurso("Agenda, Clientes e Atendimentos", True),
            _recurso("Portal público com orçamento", True),
            _recurso("Portfólio", True, "até 30 fotos"),
            _recurso("Documentos com assinatura", True, "até 10/mês"),
            _recurso("Financeiro", True, "básico (entradas)"),
            _recurso("1 usuário", True),
            _recurso("Flash Arts", False),
            _recurso("Estoque", False),
            _recurso("Relatórios", False),
        ],
    },
    {
        "slug": "profissional",
        "nome": "Profissional",
        "preco_mensal": 135.0,
        "destaque": True,
        "badge": "Mais popular",
        "promocao": PROMO_PROFISSIONAL,
        "trial_dias": TRIAL_DIAS,
        "publico_alvo": "Estúdio em crescimento",
        "descricao": "Tudo para um estúdio profissional rodar: equipe, financeiro e relatórios.",
        "limites": {
            "usuarios": 5,
            "portfolio_fotos": None,
            "documentos_mes": None,
            "storage_mb": 10240,
            "financeiro": "completo",
            "flash_arts": True,
            "estoque": True,
            "relatorios": True,
            "auditoria": True,
        },
        "recursos": [
            _recurso("Tudo do Essencial", True),
            _recurso("Até 5 usuários (artistas + recepção)", True),
            _recurso("Financeiro completo", True),
            _recurso("Relatórios", True),
            _recurso("Flash Arts (catálogo de vendas)", True),
            _recurso("Estoque", True),
            _recurso("Portfólio e documentos ilimitados", True),
            _recurso("Auditoria de segurança", True),
            _recurso("Suporte prioritário", True),
            _recurso("10 GB de mídia", True),
        ],
    },
    {
        "slug": "avancado",
        "nome": "Avançado",
        "preco_mensal": 200.0,
        "destaque": False,
        "publico_alvo": "Estúdio estabelecido / multi-artista",
        "descricao": "Para operações maiores: usuários ilimitados e relatórios avançados.",
        "limites": {
            "usuarios": None,
            "portfolio_fotos": None,
            "documentos_mes": None,
            "storage_mb": 51200,
            "financeiro": "completo",
            "flash_arts": True,
            "estoque": True,
            "relatorios": "avancado",
            "auditoria": True,
        },
        "recursos": [
            _recurso("Tudo do Profissional", True),
            _recurso("Usuários ilimitados", True),
            _recurso("Relatórios avançados + exportação", True),
            _recurso("50 GB de mídia", True),
            _recurso("Suporte prioritário + onboarding", True),
        ],
    },
]


def listar_planos_publicos() -> list[dict[str, Any]]:
    """Catálogo para a página de preços (sem dados internos sensíveis)."""
    return PLANOS


def get_plano(slug: str) -> dict[str, Any] | None:
    return next((p for p in PLANOS if p["slug"] == slug), None)
