"""Testes unitários — camada de pagamento (Mercado Pago). Sem rede."""

import hashlib
import hmac
import time

from app.core.pagamentos import (
    GatewayPagamento,
    valor_venda_centavos,
    validar_assinatura_webhook,
)
from app.core.planos import get_plano


def _assinar(secret: str, data_id: str, req_id: str, ts: str) -> str:
    manifest = f"id:{data_id};request-id:{req_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={v1}"


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


class TestPrecoTesteOverride:
    """Override de teste de pagamento: só sousavmaker@gmail.com paga R$2 no
    Essencial mensal; todo o resto segue o catálogo. (Remover após o teste.)"""

    EMAIL = "sousavmaker@gmail.com"

    def test_email_de_teste_paga_2_reais_no_essencial_mensal(self):
        plano = get_plano("essencial")
        assert valor_venda_centavos(plano, "mensal", email=self.EMAIL) == 200
        # case-insensitive + espaços
        assert valor_venda_centavos(plano, "mensal", email="  SousaVMaker@Gmail.com ") == 200
        # o preapproval cobrado no MP usa o MESMO valor (consistência cobrança↔MP)
        payload = GatewayPagamento().montar_preapproval(
            plano=plano, email_pagador=self.EMAIL, referencia="ref-teste"
        )
        assert payload["auto_recurring"]["transaction_amount"] == 2.0

    def test_outro_email_paga_preco_normal(self):
        plano = get_plano("essencial")
        assert valor_venda_centavos(plano, "mensal", email="outro@x.com") == 5000
        assert valor_venda_centavos(plano, "mensal") == 5000

    def test_override_nao_vaza_para_outro_plano_ou_ciclo(self):
        # mesmo email, outro plano → preço normal (Profissional mensal = R$135)
        assert valor_venda_centavos(get_plano("profissional"), "mensal", email=self.EMAIL) == 13500
        # mesmo email/plano, outro ciclo (não mensal) → preço normal
        assert valor_venda_centavos(get_plano("essencial"), "trimestral", email=self.EMAIL) != 200


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


class TestWebhookAntiReplay:
    """P0-07 — janela anti-replay opcional (opt-in via max_idade_segundos)."""

    secret = "chave-webhook"
    data_id = "98765"
    req_id = "req-xyz"

    def test_assinatura_fresca_dentro_da_janela(self):
        ts = str(int(time.time()))
        sig = _assinar(self.secret, self.data_id, self.req_id, ts)
        assert validar_assinatura_webhook(
            x_signature=sig, x_request_id=self.req_id, data_id=self.data_id,
            secret=self.secret, max_idade_segundos=600,
        ) is True

    def test_assinatura_antiga_rejeitada_pela_janela(self):
        ts = str(int(time.time()) - 3600)  # 1h atrás
        sig = _assinar(self.secret, self.data_id, self.req_id, ts)
        assert validar_assinatura_webhook(
            x_signature=sig, x_request_id=self.req_id, data_id=self.data_id,
            secret=self.secret, max_idade_segundos=600,
        ) is False

    def test_assinatura_antiga_aceita_sem_janela(self):
        # Sem max_idade_segundos (default), o ts antigo é aceito (comportamento legado).
        ts = str(int(time.time()) - 3600)
        sig = _assinar(self.secret, self.data_id, self.req_id, ts)
        assert validar_assinatura_webhook(
            x_signature=sig, x_request_id=self.req_id, data_id=self.data_id,
            secret=self.secret,
        ) is True

    def test_ts_em_milissegundos(self):
        ts = str(int(time.time()) * 1000)  # MP às vezes manda ms
        sig = _assinar(self.secret, self.data_id, self.req_id, ts)
        assert validar_assinatura_webhook(
            x_signature=sig, x_request_id=self.req_id, data_id=self.data_id,
            secret=self.secret, max_idade_segundos=600,
        ) is True
