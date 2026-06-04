"""P0-03 — trusted proxy / anti-spoofing de IP.

Garante que um atacante falando direto com a Fly e forjando `X-Forwarded-For`
não consiga injetar um IP falso quando `INTERNAL_PROXY_SECRET` está configurado.
"""

import pytest

from app.core import request_context
from app.core.config import settings

_REAL_CONN = "203.0.113.9"   # IP da conexão TCP (atacante / borda Fly)
_FORJADO = "1.2.3.4"          # IP que o atacante tenta injetar via XFF


class _Headers:
    def __init__(self, d: dict[str, str]):
        self._d = {k.lower(): v for k, v in d.items()}

    def get(self, k: str, default=None):
        return self._d.get(k.lower(), default)


class _Client:
    def __init__(self, host: str):
        self.host = host


class _Req:
    def __init__(self, headers: dict[str, str], client_host: str = _REAL_CONN):
        self.headers = _Headers(headers)
        self.client = _Client(client_host)


@pytest.fixture(autouse=True)
def _restaura_settings(monkeypatch):
    # Cada teste ajusta os settings explicitamente; o autouse só garante limpeza.
    monkeypatch.setattr(settings, "TRUSTED_PROXY_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "", raising=False)
    yield


def test_legado_sem_secret_confia_no_xff(monkeypatch):
    # Retrocompatível: sem INTERNAL_PROXY_SECRET, o XFF é honrado (comportamento atual).
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "")
    req = _Req({"x-forwarded-for": _FORJADO})
    assert request_context.get_client_ip(req) == _FORJADO


def test_secret_definido_sem_header_ignora_xff(monkeypatch):
    # Atacante direto: forja XFF mas não tem o segredo → usa IP da conexão.
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "segredo-proxy")
    req = _Req({"x-forwarded-for": _FORJADO})
    assert request_context.get_client_ip(req) == _REAL_CONN


def test_secret_definido_header_correto_confia(monkeypatch):
    # Proxy legítimo: traz o segredo → XFF é honrado.
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "segredo-proxy")
    req = _Req(
        {"x-forwarded-for": _FORJADO, "x-internal-proxy-secret": "segredo-proxy"}
    )
    assert request_context.get_client_ip(req) == _FORJADO


def test_secret_definido_header_errado_ignora(monkeypatch):
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "segredo-proxy")
    req = _Req(
        {"x-forwarded-for": _FORJADO, "x-internal-proxy-secret": "errado"}
    )
    assert request_context.get_client_ip(req) == _REAL_CONN


def test_trusted_proxy_desligado_sempre_ignora(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_ENABLED", False)
    monkeypatch.setattr(settings, "INTERNAL_PROXY_SECRET", "segredo-proxy")
    req = _Req(
        {"x-forwarded-for": _FORJADO, "x-internal-proxy-secret": "segredo-proxy"}
    )
    assert request_context.get_client_ip(req) == _REAL_CONN
