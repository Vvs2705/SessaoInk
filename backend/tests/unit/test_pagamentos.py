"""Testes unitários — camada de pagamento (Mercado Pago). Sem rede."""

import hashlib
import hmac

from app.core.pagamentos import (
    GatewayPagamento,
    validar_assinatura_webhook,
)
from app.core.planos import get_plano


class TestMontagemPayloads:
    def test_preference_usa_pix_total_e_parcelas(self):
        gw = GatewayPagamento()
        plano = get_plano("profissional")
        assert plano is not None
        payload = gw.montar_preference(
            plano=plano, ciclo="anual", email_pagador="a@b.com", referencia="ref-1"
        )
        item = payload["items"][0]
        assert item["currency_id"] == "BRL"
        # anual = 12 * 135 = 1620, Pix -25% = 1215.0
        assert item["unit_price"] == 1215.0
        # anual permite até 10x
        assert payload["payment_methods"]["installments"] == 10
        assert payload["external_reference"] == "ref-1"
        assert "/api/v1/pagamentos/webhook" in payload["notification_url"]

    def test_preapproval_mensal(self):
        gw = GatewayPagamento()
        plano = get_plano("profissional")
        assert plano is not None
        payload = gw.montar_preapproval(
            plano=plano, email_pagador="a@b.com", referencia="ref-2"
        )
        assert payload["auto_recurring"]["transaction_amount"] == 135.0
        assert payload["auto_recurring"]["frequency_type"] == "months"
        assert payload["payer_email"] == "a@b.com"

    def test_gateway_sem_token_nao_configurado(self):
        gw = GatewayPagamento()
        gw._token = ""
        assert gw.configurado() is False


class TestWebhookSignature:
    def test_sem_secret_e_permissivo(self):
        assert validar_assinatura_webhook(
            x_signature=None, x_request_id="r", data_id="1", secret=""
        ) is True

    def test_assinatura_valida(self):
        secret = "minha-chave-webhook"
        ts = "1700000000"
        data_id = "12345"
        req_id = "req-abc"
        manifest = f"id:{data_id};request-id:{req_id};ts:{ts};"
        v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        assert validar_assinatura_webhook(
            x_signature=f"ts={ts},v1={v1}",
            x_request_id=req_id,
            data_id=data_id,
            secret=secret,
        ) is True

    def test_assinatura_invalida(self):
        assert validar_assinatura_webhook(
            x_signature="ts=1,v1=deadbeef",
            x_request_id="r",
            data_id="1",
            secret="segredo",
        ) is False
