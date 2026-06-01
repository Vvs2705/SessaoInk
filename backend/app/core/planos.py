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


# ---------------------------------------------------------------------------
# Ciclos de cobrança (mercado BR) — compromisso + forma de pagamento.
# Pix sempre tem desconto; cartão segue a realidade brasileira de parcelamento.
# Os percentuais são "preço de lançamento" — revisar após ~3 meses.
# ---------------------------------------------------------------------------
CICLOS: list[dict[str, Any]] = [
    {
        "chave": "mensal",
        "meses": 1,
        "label": "Mensal",
        "desconto_pix": 0.0,
        "cartao": {"modo": "recorrente", "max_parcelas": 1, "juros": False},
        "obs": "Cobrança recorrente no cartão.",
    },
    {
        "chave": "trimestral",
        "meses": 3,
        "label": "Trimestral",
        "desconto_pix": 0.10,
        "cartao": {"modo": "avista", "max_parcelas": 1, "juros": False},
        "obs": "À vista. Pix com 10% de desconto.",
    },
    {
        "chave": "semestral",
        "meses": 6,
        "label": "Semestral",
        "desconto_pix": 0.15,
        "cartao": {"modo": "parcelado", "max_parcelas": 6, "juros": True},
        "obs": "Pix com 15% de desconto OU cartão parcelado com juros (até 6x).",
    },
    {
        "chave": "anual",
        "meses": 12,
        "label": "Anual",
        "desconto_pix": 0.25,
        "cartao": {"modo": "parcelado", "max_parcelas": 10, "juros": False},
        "obs": "Pix com 25% de desconto OU até 10x sem juros no cartão.",
    },
]


def _round2(v: float) -> float:
    return round(v + 1e-9, 2)


def tabela_precos(plano: dict[str, Any]) -> list[dict[str, Any]]:
    """Calcula, para cada ciclo, o total via Pix e via cartão (com parcelas)."""
    mensal = float(plano["preco_mensal"])
    tabela: list[dict[str, Any]] = []
    for c in CICLOS:
        base = mensal * c["meses"]
        pix_total = _round2(base * (1 - c["desconto_pix"]))
        cartao = c["cartao"]
        # Cartão sem juros: total = base (nós absorvemos). Com juros: emissor cobra
        # o cliente; o total nominal exibido é a base (parcela = base / n).
        cartao_total = _round2(base)
        max_parc = cartao["max_parcelas"]
        cartao_parcela = _round2(cartao_total / max_parc) if max_parc else cartao_total
        tabela.append(
            {
                "ciclo": c["chave"],
                "label": c["label"],
                "meses": c["meses"],
                "preco_cheio": _round2(base),
                "pix_total": pix_total,
                "desconto_pix_pct": int(c["desconto_pix"] * 100),
                "cartao_total": cartao_total,
                "cartao_max_parcelas": max_parc,
                "cartao_parcela": cartao_parcela,
                "cartao_juros": cartao["juros"],
                "cartao_modo": cartao["modo"],
                "obs": c["obs"],
            }
        )
    return tabela


def listar_planos_publicos() -> list[dict[str, Any]]:
    """Catálogo para a página de preços, com a tabela de ciclos/pagamento por plano."""
    return [{**p, "tabela_precos": tabela_precos(p)} for p in PLANOS]


def get_plano(slug: str) -> dict[str, Any] | None:
    return next((p for p in PLANOS if p["slug"] == slug), None)
