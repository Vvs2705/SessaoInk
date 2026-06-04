"""Verificação pré-go-live de cobrança (Mercado Pago).

Roda as mesmas pré-condições aplicadas no startup (`erros_go_live`) sem subir o
servidor. Use ANTES de ligar `PAGAMENTOS_GO_LIVE=true` em produção.

Uso (com as envs/secrets de produção carregadas):

    cd backend && python scripts/check_go_live.py
    # via Fly: fly ssh console -C "python scripts/check_go_live.py"

Saída: relatório PASS/FAIL por requisito. Exit code 0 = pronto, 1 = bloqueado.
Nunca imprime valores de secrets — só presença/ausência.
"""

from __future__ import annotations

import sys

from app.core.config import erros_go_live, settings


def main() -> int:
    print("== SessãoInk — checagem de go-live de pagamentos ==\n")
    print(f"ENVIRONMENT       : {settings.ENVIRONMENT}")
    print(f"PAGAMENTOS_GO_LIVE: {settings.PAGAMENTOS_GO_LIVE}\n")

    requisitos = {
        "MERCADO_PAGO_ACCESS_TOKEN": bool(settings.MERCADO_PAGO_ACCESS_TOKEN),
        "MERCADO_PAGO_PUBLIC_KEY": bool(settings.MERCADO_PAGO_PUBLIC_KEY),
        "MERCADO_PAGO_WEBHOOK_SECRET": bool(settings.MERCADO_PAGO_WEBHOOK_SECRET),
        "APP_URL com HTTPS": settings.APP_URL.lower().startswith("https://"),
        "CSRF_STRICT_MODE": settings.CSRF_STRICT_MODE,
        "SENTRY_DSN": bool(settings.SENTRY_DSN),
    }
    for nome, ok in requisitos.items():
        print(f"  [{'PASS' if ok else 'FAIL'}] {nome}")

    erros = erros_go_live(settings)
    print()
    if not settings.PAGAMENTOS_GO_LIVE:
        print("PAGAMENTOS_GO_LIVE está desligado — nenhuma cobrança real é feita.")
        print("Quando ligar, todos os requisitos acima precisam estar PASS.")
        return 0 if not erros else 1

    if erros:
        print("BLOQUEADO — corrija antes de habilitar cobrança real:")
        for e in erros:
            print(f"  - {e}")
        return 1

    print("PRONTO — pré-condições de go-live satisfeitas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
