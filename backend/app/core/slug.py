"""Validação e normalização de slug do portal público (`/<slug>`).

O slug é o texto final do link do portal do cliente — ex.: `sessao-ink.vercel.app/estudio-do-joao`.
Precisa ser único, seguro para URL e não colidir com rotas do frontend.
"""

import re
import unicodedata

# Rotas de topo do frontend que NÃO podem ser usadas como slug (colisão de URL).
SLUGS_RESERVADOS: frozenset[str] = frozenset(
    {
        "api",
        "app",
        "admin",
        "login",
        "logout",
        "auth",
        "dashboard",
        "configuracoes",
        "precos",
        "planos",
        "mais",
        "sobre",
        "contato",
        "ajuda",
        "suporte",
        "termos",
        "privacidade",
        "portfolio",
        "orcamento",
        "flash-arts",
        "documento",
        "static",
        "assets",
        "public",
        "www",
        "_next",
        "favicon",
        "robots",
        "sitemap",
        "sessaoink",
        "sessao-ink",
    }
)

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SLUG_MIN = 3
SLUG_MAX = 50


class SlugInvalidoError(ValueError):
    """Slug fora das regras (formato, tamanho ou reservado)."""


def slugify(texto: str) -> str:
    """Gera um slug-base a partir de um texto livre (ex.: nome do estúdio)."""
    normalizado = unicodedata.normalize("NFKD", texto)
    sem_acentos = normalizado.encode("ascii", "ignore").decode("ascii")
    minusculo = sem_acentos.lower()
    com_hifens = re.sub(r"[^a-z0-9]+", "-", minusculo)
    return com_hifens.strip("-")


def validar_slug(slug: str) -> str:
    """Valida e retorna o slug normalizado. Lança SlugInvalidoError se inválido."""
    candidato = (slug or "").strip().lower()
    if len(candidato) < SLUG_MIN or len(candidato) > SLUG_MAX:
        raise SlugInvalidoError(
            f"O link deve ter entre {SLUG_MIN} e {SLUG_MAX} caracteres."
        )
    if not _SLUG_RE.match(candidato):
        raise SlugInvalidoError(
            "Use apenas letras minúsculas, números e hífens (sem espaços ou acentos)."
        )
    if candidato in SLUGS_RESERVADOS:
        raise SlugInvalidoError("Esse link é reservado pelo sistema. Escolha outro.")
    return candidato
