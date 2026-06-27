"""Testes de integração — Pagamentos (config, checkout gated, webhook idempotente)."""

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session
from app.models.saas import (
    Assinatura,
    Cobranca,
    Pagamento,
    StatusAssinatura,
    StatusCobranca,
)
from app.models.usuario import Estudio


async def _estudio_demo_id() -> uuid.UUID:
    async with async_session() as s:
        est = await s.scalar(select(Estudio).where(Estudio.slug == "demo"))
        assert est is not None
        return est.id


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

    async def test_checkout_rejeita_card_number(self, autenticado: AsyncClient):
        # P0-05 — dado de cartão é rejeitado com 400 (antes mesmo do gate de go-live).
        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={
                "plano_slug": "profissional",
                "ciclo": "mensal",
                "card_number": "4111111111111111",
            },
        )
        assert r.status_code == 400, r.text

    async def test_checkout_rejeita_cvv(self, autenticado: AsyncClient):
        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal", "cvv": "123"},
        )
        assert r.status_code == 400, r.text


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


class TestP006CobrancaLocal:
    """P0-06 — cobrança local antes do gateway + reconciliação com validação de valor."""

    async def test_checkout_cria_cobranca_local_e_reusa(self, autenticado, monkeypatch):
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        calls = {"n": 0, "ref": None}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            calls["n"] += 1
            calls["ref"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-1", "init_point": "https://mp/checkout/1"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)

        r1 = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "anual"},
        )
        assert r1.status_code == 201, r1.text

        # external_reference passado ao gateway = id da cobrança (UUID), NÃO o estudio_id.
        est_id = await _estudio_demo_id()
        assert calls["ref"] != str(est_id)
        uuid.UUID(calls["ref"])  # é UUID válido
        async with async_session() as s:
            cob = await s.scalar(
                select(Cobranca).where(Cobranca.external_reference == calls["ref"])
            )
            assert cob is not None
            assert str(cob.id) == cob.external_reference
            assert cob.valor_centavos == 121500  # anual pix_total 1215.00

        # Segundo checkout (mesmo plano/ciclo) reaproveita → gateway NÃO é chamado de novo.
        r2 = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "anual"},
        )
        assert r2.status_code == 201
        assert calls["n"] == 1

    async def test_webhook_valor_correto_ativa_assinatura(
        self, autenticado, client, monkeypatch
    ):
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-2", "init_point": "https://mp/2"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)

        est_id = await _estudio_demo_id()
        async with async_session() as s:
            if not await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id)):
                s.add(Assinatura(estudio_id=est_id, status=StatusAssinatura.TRIAL))
                await s.commit()

        await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "semestral"},
        )
        cob_ref = ref["v"]
        async with async_session() as s:
            esperado = (
                await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            ).valor_centavos

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_obter(_pid):
            return {
                "status": "approved",
                "external_reference": cob_ref,
                "transaction_amount": esperado / 100,
                "payment_type_id": "pix",
                "payment_method_id": "pix",
                "currency_id": "BRL",
            }

        monkeypatch.setattr(pr.gateway, "obter_pagamento", fake_obter)

        w = await client.post(
            "/api/v1/pagamentos/webhook", json={"type": "payment", "data": {"id": "pay-ok-1"}}
        )
        assert w.status_code == 200

        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            assert cob.status == StatusCobranca.PAGA
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            assert ass.status == StatusAssinatura.ATIVA
            pag = await s.scalar(
                select(Pagamento).where(Pagamento.gateway_payment_id == "pay-ok-1")
            )
            assert pag is not None and pag.reconciliado_em is not None

    async def test_webhook_preapproval_autorizado_ativa_assinatura(
        self, autenticado, client, monkeypatch
    ):
        """Ciclo MENSAL: o webhook `preapproval` (recorrência) deve ativar a
        assinatura quando autorizado — o evento `payment` não cobre esse ciclo."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_assinatura(*, plano_slug, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "assinatura", "id": "preapp-ok-1", "init_point": "https://mp/sub"}

        monkeypatch.setattr(pr.gateway, "criar_assinatura", fake_assinatura)

        est_id = await _estudio_demo_id()
        async with async_session() as s:
            if not await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id)):
                s.add(Assinatura(estudio_id=est_id, status=StatusAssinatura.TRIAL))
                await s.commit()

        await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        cob_ref = ref["v"]
        async with async_session() as s:
            esperado = (
                await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            ).valor_centavos

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_preapproval(_pid):
            return {
                "status": "authorized",
                "external_reference": cob_ref,
                "auto_recurring": {
                    "transaction_amount": esperado / 100,
                    "currency_id": "BRL",
                },
            }

        monkeypatch.setattr(pr.gateway, "obter_preapproval", fake_preapproval)

        w = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "preapproval", "data": {"id": "preapp-ok-1"}},
        )
        assert w.status_code == 200

        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            assert cob.status == StatusCobranca.PAGA
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            assert ass.status == StatusAssinatura.ATIVA

    async def test_webhook_valor_divergente_nao_ativa(
        self, autenticado, client, monkeypatch
    ):
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-3", "init_point": "https://mp/3"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)
        await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "trimestral"},
        )
        cob_ref = ref["v"]

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_obter(_pid):
            # Valor propositalmente errado (R$ 1,00).
            return {
                "status": "approved",
                "external_reference": cob_ref,
                "transaction_amount": 1.0,
                "payment_type_id": "pix",
                "payment_method_id": "pix",
                "currency_id": "BRL",
            }

        monkeypatch.setattr(pr.gateway, "obter_pagamento", fake_obter)

        w = await client.post(
            "/api/v1/pagamentos/webhook", json={"type": "payment", "data": {"id": "pay-bad-1"}}
        )
        assert w.status_code == 200

        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            # Valor divergente → cobrança NÃO é marcada como paga.
            assert cob.status != StatusCobranca.PAGA
