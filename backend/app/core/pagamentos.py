"""Camada de pagamento — Mercado Pago (gateway BR).

Cobre os modos do catálogo (`app/core/planos.py`):
  - Ciclos avulsos (trimestral/semestral/anual) → Checkout Preference única,
    com Pix (desconto aplicado no valor) e cartão parcelado.
  - Mensal → assinatura recorrente (preapproval).

Segurança e segredo:
  - O ACCESS_TOKEN vive apenas como Fly secret (nunca no repo/logs).
  - Toda criação de cobrança real é trancada por `settings.PAGAMENTOS_GO_LIVE`
    no router — esta camada apenas monta payloads e fala com a API quando chamada.

Esta camada NÃO importa o SDK do Mercado Pago: usa httpx direto (timeout-bounded,
idempotency key), mantendo o módulo importável e testável sem dependências extras.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.planos import CICLOS, get_plano, tabela_precos

logger = logging.getLogger(__name__)

MP_API_BASE = "https://api.mercadopago.com"
_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class GatewayNaoConfiguradoError(RuntimeError):
    """Levantada quando se tenta cobrar sem ACCESS_TOKEN configurado."""


class GatewayPagamentoError(RuntimeError):
    """Erro de comunicação/negócio com o gateway."""


# ---------------------------------------------------------------------------
# OVERRIDE DE TESTE DE PAGAMENTO — REMOVER APÓS O TESTE  # noqa
# ---------------------------------------------------------------------------
# Apenas o email abaixo paga um valor reduzido no Essencial MENSAL, para validar
# o recebimento real ponta a ponta (cobrança → MP → webhook → ativação). Qualquer
# outro email/plano/ciclo segue o preço normal do catálogo. Aplicado server-side
# de forma consistente na cobrança local e no preapproval do MP. Remover este
# bloco (e o argumento `email` de `valor_venda_centavos`) ao concluir o teste.
_PRECO_TESTE_EMAIL = "sousavmaker@gmail.com"
_PRECO_TESTE_PLANO = "essencial"
# mensal (recorrente, cartão/saldo) e trimestral (avulso/Checkout Pro, mostra Pix).
_PRECO_TESTE_CICLOS = ("mensal", "trimestral")
_PRECO_TESTE_REAIS = 2.0


def preco_teste_override_reais(
    email: str | None, plano_slug: str | None, ciclo: str
) -> float | None:
    """Valor (em reais) do teste de pagamento quando (email, plano, ciclo) batem
    com o caso de teste; senão None. Email comparado sem espaços e case-insensitive."""
    if (
        email
        and email.strip().lower() == _PRECO_TESTE_EMAIL
        and plano_slug == _PRECO_TESTE_PLANO
        and ciclo in _PRECO_TESTE_CICLOS
    ):
        return _PRECO_TESTE_REAIS
    return None


def _ciclo_info(chave: str) -> dict[str, Any] | None:
    return next((c for c in CICLOS if c["chave"] == chave), None)


def _linha_preco(plano: dict[str, Any], ciclo: str) -> dict[str, Any] | None:
    return next((t for t in tabela_precos(plano) if t["ciclo"] == ciclo), None)


def valor_venda_centavos(plano: dict[str, Any], ciclo: str, email: str | None = None) -> int:
    """Valor de venda (em centavos) calculado SEMPRE no servidor (P0-06).

    Mensal = preço mensal; demais ciclos = `pix_total` (preço de venda com
    desconto do ciclo). Nunca confiar em valor vindo do cliente.

    `email` é usado apenas pelo override de teste de pagamento (preço reduzido
    para um email específico); ignorado para os demais.
    """
    override = preco_teste_override_reais(email, plano.get("slug"), ciclo)
    if override is not None:
        return int(round(override * 100))
    if ciclo == "mensal":
        reais = float(plano["preco_mensal"])
    else:
        linha = _linha_preco(plano, ciclo)
        if not linha:
            raise GatewayPagamentoError(f"Ciclo inválido para o plano: {ciclo}")
        reais = float(linha["pix_total"])
    return int(round(reais * 100))


class GatewayPagamento:
    """Adaptador fino sobre a API do Mercado Pago."""

    def __init__(self) -> None:
        self._token = settings.MERCADO_PAGO_ACCESS_TOKEN

    def configurado(self) -> bool:
        return bool(self._token)

    def _exigir_token(self) -> str:
        if not self._token:
            raise GatewayNaoConfiguradoError(
                "MERCADO_PAGO_ACCESS_TOKEN não configurado — cobrança indisponível."
            )
        return self._token

    def _headers(self, idempotency_key: str | None = None) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self._exigir_token()}",
            "Content-Type": "application/json",
        }
        if idempotency_key:
            headers["X-Idempotency-Key"] = idempotency_key
        return headers

    async def _post(
        self, path: str, payload: dict[str, Any], idempotency_key: str | None = None
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=MP_API_BASE, timeout=_HTTP_TIMEOUT) as client:
            resp = await client.post(
                path, json=payload, headers=self._headers(idempotency_key)
            )
        if resp.status_code >= 400:
            logger.warning(
                "mercadopago_erro",
                extra={"extra": {"path": path, "status": resp.status_code}},
            )
            raise GatewayPagamentoError(
                f"Mercado Pago retornou {resp.status_code} em {path}"
            )
        return resp.json()

    async def _get(self, path: str) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=MP_API_BASE, timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(path, headers=self._headers())
        if resp.status_code >= 400:
            raise GatewayPagamentoError(
                f"Mercado Pago retornou {resp.status_code} em {path}"
            )
        return resp.json()

    # -- Montagem de payloads (puro — testável sem rede) --------------------
    def montar_preference(
        self,
        *,
        plano: dict[str, Any],
        ciclo: str,
        email_pagador: str,
        referencia: str,
    ) -> dict[str, Any]:
        """Checkout Preference para pagamento avulso (Pix + cartão parcelado).

        O valor já reflete o desconto Pix do ciclo (preço de venda). Parcelamento
        no cartão segue `cartao_max_parcelas` do ciclo.
        """
        linha = _linha_preco(plano, ciclo)
        ciclo_info = _ciclo_info(ciclo)
        if not linha or not ciclo_info:
            raise GatewayPagamentoError(f"Ciclo inválido para o plano: {ciclo}")

        max_parcelas = int(linha["cartao_max_parcelas"] or 1)
        override = preco_teste_override_reais(email_pagador, plano.get("slug"), ciclo)
        valor = override if override is not None else float(linha["pix_total"])
        app_url = settings.APP_URL.rstrip("/")

        return {
            "items": [
                {
                    "title": f"SessãoInk {plano['nome']} — {linha['label']}",
                    "description": f"Plano {plano['nome']} ({ciclo})",
                    "quantity": 1,
                    "currency_id": "BRL",
                    "unit_price": valor,
                }
            ],
            "payer": {"email": email_pagador},
            "payment_methods": {
                "installments": max_parcelas,
                "default_installments": 1,
            },
            "external_reference": referencia,
            "back_urls": {
                "success": f"{app_url}/configuracoes?pagamento=sucesso",
                "pending": f"{app_url}/configuracoes?pagamento=pendente",
                "failure": f"{app_url}/configuracoes?pagamento=falha",
            },
            "auto_return": "approved",
            "notification_url": f"{app_url}/api/v1/pagamentos/webhook",
        }

    def montar_preapproval(
        self, *, plano: dict[str, Any], email_pagador: str, referencia: str
    ) -> dict[str, Any]:
        """Assinatura recorrente mensal (preapproval) cobrada no cartão."""
        override = preco_teste_override_reais(email_pagador, plano.get("slug"), "mensal")
        valor = override if override is not None else float(plano["preco_mensal"])
        app_url = settings.APP_URL.rstrip("/")
        return {
            "reason": f"SessãoInk {plano['nome']} (mensal)",
            "external_reference": referencia,
            "payer_email": email_pagador,
            "auto_recurring": {
                "frequency": 1,
                "frequency_type": "months",
                "transaction_amount": valor,
                "currency_id": "BRL",
            },
            "back_url": f"{app_url}/configuracoes?assinatura=ok",
            "status": "pending",
        }

    # -- Chamadas reais (exigem token) -------------------------------------
    async def criar_cobranca_unica(
        self, *, plano_slug: str, ciclo: str, email_pagador: str, referencia: str
    ) -> dict[str, Any]:
        plano = get_plano(plano_slug)
        if not plano:
            raise GatewayPagamentoError(f"Plano inexistente: {plano_slug}")
        payload = self.montar_preference(
            plano=plano, ciclo=ciclo, email_pagador=email_pagador, referencia=referencia
        )
        data = await self._post(
            "/checkout/preferences", payload, idempotency_key=referencia
        )
        return {
            "tipo": "cobranca_unica",
            "id": data.get("id"),
            "init_point": data.get("init_point") or data.get("sandbox_init_point"),
        }

    async def criar_assinatura(
        self, *, plano_slug: str, email_pagador: str, referencia: str
    ) -> dict[str, Any]:
        plano = get_plano(plano_slug)
        if not plano:
            raise GatewayPagamentoError(f"Plano inexistente: {plano_slug}")
        payload = self.montar_preapproval(
            plano=plano, email_pagador=email_pagador, referencia=referencia
        )
        data = await self._post("/preapproval", payload, idempotency_key=referencia)
        return {
            "tipo": "assinatura",
            "id": data.get("id"),
            "init_point": data.get("init_point"),
        }

    async def obter_pagamento(self, pagamento_id: str) -> dict[str, Any]:
        """Consulta o status de um pagamento (usado pelo webhook)."""
        return await self._get(f"/v1/payments/{pagamento_id}")

    async def obter_preapproval(self, preapproval_id: str) -> dict[str, Any]:
        """Consulta o status de uma assinatura recorrente (preapproval) — usado
        pelo webhook para reconciliar o ciclo mensal."""
        return await self._get(f"/preapproval/{preapproval_id}")


def validar_assinatura_webhook(
    *,
    x_signature: str | None,
    x_request_id: str | None,
    data_id: str | None,
    secret: str | None = None,
    max_idade_segundos: int | None = None,
) -> bool:
    """Valida a assinatura HMAC do webhook do Mercado Pago.

    Manifesto: `id:{data.id};request-id:{x-request-id};ts:{ts};`
    `x-signature` traz `ts=<unix>,v1=<hmac sha256 hex>`.
    Se não houver secret configurado, retorna True (modo permissivo em ambientes
    sem segredo — o go-live exige o secret presente).

    `max_idade_segundos` (P0-07 anti-replay): quando definido, rejeita assinaturas
    cujo `ts` esteja fora da janela [agora - janela, agora + janela]. Opt-in para
    não alterar chamadas existentes; o router liga com uma janela de minutos.
    """
    secret = secret if secret is not None else settings.MERCADO_PAGO_WEBHOOK_SECRET
    if not secret:
        return True
    if not x_signature:
        return False

    partes = dict(
        p.split("=", 1) for p in x_signature.split(",") if "=" in p
    )
    ts = partes.get("ts", "").strip()
    v1 = partes.get("v1", "").strip()
    if not ts or not v1:
        return False

    manifest = f"id:{data_id or ''};request-id:{x_request_id or ''};ts:{ts};"
    esperado = hmac.new(
        secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(esperado, v1):
        return False

    # P0-07 — janela anti-replay: um webhook válido capturado não pode ser
    # reenviado horas depois. Aceita ts em segundos ou milissegundos.
    if max_idade_segundos is not None:
        try:
            ts_val = int(ts)
        except ValueError:
            return False
        if ts_val > 10**12:  # heurística: timestamp em milissegundos
            ts_val //= 1000
        if abs(time.time() - ts_val) > max_idade_segundos:
            return False

    return True


# Instância padrão reutilizável.
gateway = GatewayPagamento()
