"""Contexto de request — extração centralizada e segura do IP real do cliente.

Arquitetura de rede do SessãoInk:

    Browser → Vercel (proxy Next.js, server-side fetch) → Fly.io (este backend)

O backend nunca enxerga o IP do browser diretamente: a conexão TCP chega da
infraestrutura da Vercel (para tráfego proxiado) ou do edge da Fly. Por isso:

- A Fly injeta `Fly-Client-IP` com o IP de quem abriu a conexão com a Fly
  (não falsificável pelo cliente — a plataforma sobrescreve o header).
- O proxy Next.js encaminha o IP real do browser em `X-Forwarded-For`
  (lido do header que a própria Vercel define na borda).

`get_client_ip` resolve o IP real numa ordem determinística e ignora headers de
proxy quando a confiança está desligada (`TRUSTED_PROXY_ENABLED=false`),
evitando spoofing de `X-Forwarded-For` em acesso direto à API.
"""

import ipaddress
import secrets

from fastapi import Request

from app.core.config import settings

_IP_HEADERS_PROXY = (
    "x-forwarded-for",   # padrão; pode conter cadeia "cliente, proxy1, proxy2"
    "x-real-ip",         # definido por alguns proxies
    "cf-connecting-ip",  # Cloudflare, se algum dia entrar na frente
    "fly-client-ip",     # Fly.io edge
)


def _primeiro_ip_valido(valor: str) -> str | None:
    """Retorna o primeiro IP público/válido de uma cadeia separada por vírgula."""
    for parte in valor.split(","):
        candidato = parte.strip()
        if not candidato:
            continue
        # Remover porta se presente (ex.: "1.2.3.4:5678")
        if candidato.count(":") == 1 and "." in candidato:
            candidato = candidato.split(":", 1)[0]
        try:
            ip = ipaddress.ip_address(candidato)
        except ValueError:
            continue
        return str(ip)
    return None


def _proxy_confiavel(request: Request) -> bool:
    """Decide se os headers de IP de proxy deste request são confiáveis.

    - `TRUSTED_PROXY_ENABLED=false` → nunca confia (acesso direto não confiável).
    - `INTERNAL_PROXY_SECRET` definido → só confia se o request trouxer
      `X-Internal-Proxy-Secret` igual ao segredo (P0-03 anti-spoofing): um
      atacante que fale direto com a Fly e forje `X-Forwarded-For` não tem o
      segredo, então o header é ignorado e usamos o IP da conexão real.
    - `INTERNAL_PROXY_SECRET` vazio → comportamento legado retrocompatível
      (confia no XFF sempre que TRUSTED_PROXY_ENABLED).
    """
    if not settings.TRUSTED_PROXY_ENABLED:
        return False
    segredo = settings.INTERNAL_PROXY_SECRET
    if not segredo:
        return True
    enviado = request.headers.get("x-internal-proxy-secret", "")
    return bool(enviado) and secrets.compare_digest(enviado, segredo)


def get_client_ip(request: Request) -> str:
    """Resolve o IP real do cliente de forma centralizada e segura.

    Ordem (quando o proxy é confiável — ver `_proxy_confiavel`):
        1. Primeiro IP válido de `X-Forwarded-For` (IP do browser via proxy Vercel).
        2. `X-Real-IP` / `CF-Connecting-IP` / `Fly-Client-IP`.
        3. IP da conexão TCP (`request.client.host`).

    Quando o proxy não é confiável (acesso direto ou segredo ausente/incorreto),
    usa apenas o IP da conexão — headers de proxy forjados são ignorados.
    """
    if _proxy_confiavel(request):
        for header in _IP_HEADERS_PROXY:
            valor = request.headers.get(header)
            if valor:
                ip = _primeiro_ip_valido(valor)
                if ip:
                    return ip

    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def get_user_agent(request: Request) -> str:
    """User-Agent do request, truncado para armazenamento seguro (máx. 500 chars)."""
    return (request.headers.get("user-agent") or "unknown")[:500]
