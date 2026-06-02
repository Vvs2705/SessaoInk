"""Testes de integração — Pagamentos (config, checkout gated, webhook idempotente)."""

import uuid

from httpx import AsyncClient


class TestConfigECheckout:
    async def test_config_retorna_go_live_desligado(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/pagamentos/config")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["gateway"] == "mercadopago"
        assert body["go_live"] is False

    async def test_checkout_bloqueado_sem_go_live(self, autenticado: AsyncClient):
        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        assert r.status_code == 503, r.text

    async def test_checkout_exige_auth(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        assert r.status_code == 401


class TestWebhook:
    async def test_webhook_idempotente(self, client: AsyncClient):
        recurso = f"pay-{uuid.uuid4().hex[:10]}"
        payload = {"type": "payment", "data": {"id": recurso}}

        r1 = await client.post("/api/v1/pagamentos/webhook", json=payload)
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] in ("ok", "registrado")

        # Reenvio do mesmo evento → dedup
        r2 = await client.post("/api/v1/pagamentos/webhook", json=payload)
        assert r2.status_code == 200
        assert r2.json()["status"] == "duplicado"

    async def test_webhook_assinatura_invalida_quando_secret_definido(
        self, client: AsyncClient, monkeypatch
    ):
        from app.core import pagamentos as pag

        monkeypatch.setattr(pag.settings, "MERCADO_PAGO_WEBHOOK_SECRET", "segredo-teste")
        r = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "payment", "data": {"id": "x123"}},
            headers={"x-signature": "ts=1,v1=invalido", "x-request-id": "r1"},
        )
        assert r.status_code == 401
