"""P0-05 — proibição de dados de cartão e redaction de dados sensíveis.

Dois objetivos, independentes de FastAPI (importável em qualquer camada):

1. `contem_dados_cartao` / `motivo_dados_cartao`: detecta PAN/CVV e campos
   proibidos em payloads que chegam ao backend (o SessãoInk usa Checkout Pro —
   nenhum dado de cartão deve trafegar por aqui). O router rejeita com 400.
2. `redigir_sensivel`: mascara recursivamente chaves sensíveis (Authorization,
   Cookie, tokens, segredos, campos de cartão, QR Pix) antes de logar/enviar ao
   Sentry. Defesa: nenhum log/evento carrega segredo ou dado de cartão.
"""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

# Chaves cujo VALOR nunca deve aparecer em log/Sentry (comparação normalizada:
# minúsculas, sem `_`/`-`/espaço).
_CHAVES_SENSIVEIS = {
    "authorization",
    "cookie",
    "setcookie",
    "password",
    "senha",
    "secret",
    "token",
    "accesstoken",
    "refreshtoken",
    "mercadopagoaccesstoken",
    "mercadopagowebhooksecret",
    "internalproxysecret",
    "cardnumber",
    "cvv",
    "cvc",
    "securitycode",
    "qrcode",
    "qrcodebase64",
    "ticketurl",
}

# Campos proibidos em payloads de pagamento (dados de cartão / autenticação).
_CHAVES_CARTAO = {
    "cardnumber",
    "number",
    "pan",
    "cvv",
    "cvc",
    "cvv2",
    "securitycode",
    "cardpassword",
    "card",
    "track1",
    "track2",
    "magstripe",
}

# PAN provável: 13–19 dígitos (com separadores opcionais). Validado por Luhn
# para reduzir falso-positivo com ids longos.
_PAN_RE = re.compile(r"(?:\d[ -]?){13,19}")


def _norm(chave: str) -> str:
    return re.sub(r"[ _\-]", "", chave).lower()


def _luhn_ok(numero: str) -> bool:
    digitos = [int(c) for c in numero if c.isdigit()]
    if not (13 <= len(digitos) <= 19):
        return False
    soma = 0
    par = False
    for d in reversed(digitos):
        if par:
            d *= 2
            if d > 9:
                d -= 9
        soma += d
        par = not par
    return soma % 10 == 0


def _valor_parece_pan(valor: str) -> bool:
    for m in _PAN_RE.finditer(valor):
        if _luhn_ok(m.group()):
            return True
    return False


def motivo_dados_cartao(obj: Any, _profundidade: int = 0) -> str | None:
    """Retorna o motivo se o payload contém dado de cartão proibido, senão None."""
    if _profundidade > 6:
        return None
    if isinstance(obj, dict):
        for chave, valor in obj.items():
            if _norm(str(chave)) in _CHAVES_CARTAO:
                return f"campo proibido de cartão: {chave}"
            motivo = motivo_dados_cartao(valor, _profundidade + 1)
            if motivo:
                return motivo
        return None
    if isinstance(obj, (list, tuple)):
        for item in obj:
            motivo = motivo_dados_cartao(item, _profundidade + 1)
            if motivo:
                return motivo
        return None
    if isinstance(obj, str) and _valor_parece_pan(obj):
        return "valor com aparência de número de cartão (PAN)"
    return None


def contem_dados_cartao(obj: Any) -> bool:
    return motivo_dados_cartao(obj) is not None


def redigir_sensivel(obj: Any, _profundidade: int = 0) -> Any:
    """Mascara recursivamente valores de chaves sensíveis. Não altera o original."""
    if _profundidade > 8:
        return obj
    if isinstance(obj, dict):
        out: dict[Any, Any] = {}
        for chave, valor in obj.items():
            if _norm(str(chave)) in _CHAVES_SENSIVEIS:
                out[chave] = REDACTED
            else:
                out[chave] = redigir_sensivel(valor, _profundidade + 1)
        return out
    if isinstance(obj, list):
        return [redigir_sensivel(item, _profundidade + 1) for item in obj]
    if isinstance(obj, tuple):
        return tuple(redigir_sensivel(item, _profundidade + 1) for item in obj)
    return obj
