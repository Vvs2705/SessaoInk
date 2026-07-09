"""Testes de integração — Pagamentos (config, checkout gated, webhook idempotente)."""

import uuid
from datetime import UTC, datetime, timedelta

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


async def _set_assinatura(est_id: uuid.UUID, **campos) -> None:
    """Ajusta a assinatura (única) do estúdio demo para o estado desejado.

    Os testes de integração compartilham o mesmo banco, então cada teste fixa o
    estado que precisa em vez de assumir o deixado por outro."""
    async with async_session() as s:
        ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
        assert ass is not None
        for campo, valor in campos.items():
            setattr(ass, campo, valor)
        await s.commit()


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

    async def test_reconciliar_ativa_assinatura_quando_webhook_se_perde(
        self, autenticado, monkeypatch
    ):
        """Rede de segurança: o endpoint /reconciliar consulta o MP e ativa a
        assinatura de uma cobrança avulsa paga, mesmo sem o webhook ter chegado."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-rec", "init_point": "https://mp/rec"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)

        est_id = await _estudio_demo_id()
        async with async_session() as s:
            if not await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id)):
                s.add(Assinatura(estudio_id=est_id, status=StatusAssinatura.TRIAL))
                await s.commit()

        await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "trimestral"},
        )
        cob_ref = ref["v"]
        async with async_session() as s:
            esperado = (
                await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            ).valor_centavos

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_search(external_reference):
            return {"results": [{"status": "approved", "transaction_amount": esperado / 100,
                                 "id": "pay-rec-1", "payment_type_id": "pix"}]}

        monkeypatch.setattr(pr.gateway, "buscar_pagamentos_por_referencia", fake_search)

        r = await autenticado.post("/api/v1/pagamentos/reconciliar")
        assert r.status_code == 200
        assert r.json()["ativada"] is True
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


class TestCancelamento:
    """Cancelamento in-app: agenda o fim sem revogar o acesso na hora."""

    async def test_cancelar_exige_auth(self, client: AsyncClient):
        r = await client.post("/api/v1/pagamentos/cancelar")
        assert r.status_code == 401

    async def test_admin_cancela_preapproval_e_mantem_acesso(
        self, autenticado, monkeypatch
    ):
        from app.api.v1.pagamentos import router as pr

        est_id = await _estudio_demo_id()
        await _set_assinatura(
            est_id,
            status=StatusAssinatura.ATIVA,
            ciclo="mensal",
            externo_id="preapp-cancel-1",
            cancelar_no_fim=False,
            periodo_fim=None,
        )

        chamadas: list[str] = []
        fim_ciclo = (datetime.now(UTC) + timedelta(days=18)).replace(microsecond=0)

        async def fake_obter(preapproval_id):
            # O MP devolve o next_payment_date = fim do ciclo já pago.
            return {"status": "authorized", "next_payment_date": fim_ciclo.isoformat()}

        async def fake_cancelar(preapproval_id):
            chamadas.append(preapproval_id)
            return {"status": "cancelled", "id": preapproval_id}

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)
        monkeypatch.setattr(pr.gateway, "obter_preapproval", fake_obter)
        monkeypatch.setattr(pr.gateway, "cancelar_preapproval", fake_cancelar)

        r = await autenticado.post("/api/v1/pagamentos/cancelar")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["cancelar_no_fim"] is True
        # Padrão SaaS justo: acesso segue liberado até o fim do período.
        assert body["acesso_liberado"] is True
        # Recorrente mensal → cancelou o preapproval no MP.
        assert chamadas == ["preapp-cancel-1"]

        async with async_session() as s:
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            assert ass.cancelar_no_fim is True
            # Não revoga na hora: status continua ATIVA.
            assert ass.status == StatusAssinatura.ATIVA
            # Gravou o fim do ciclo pago → acesso lazy até lá (não some na hora).
            # SQLite devolve datetime naive; comparamos sem tz.
            assert ass.periodo_fim is not None
            delta = ass.periodo_fim.replace(tzinfo=None) - fim_ciclo.replace(tzinfo=None)
            assert abs(delta.total_seconds()) < 2

        # Idempotente: 2ª chamada não explode e NÃO fala de novo com o gateway.
        r2 = await autenticado.post("/api/v1/pagamentos/cancelar")
        assert r2.status_code == 200, r2.text
        assert r2.json()["cancelar_no_fim"] is True
        assert chamadas == ["preapp-cancel-1"]

    async def _cobranca_preapproval(self, est_id, preapproval_id: str, ref: str):
        """Insere uma Cobrança mensal ligada a um preapproval (sem passar pelo
        checkout — evita o reuso de cobrança pendente <24h entre testes)."""
        async with async_session() as s:
            s.add(
                Cobranca(
                    estudio_id=est_id,
                    plano_slug="profissional",
                    ciclo="mensal",
                    valor_centavos=13500,
                    status=StatusCobranca.ENVIADA_GATEWAY,
                    gateway_preapproval_id=preapproval_id,
                    external_reference=ref,
                    idempotency_key=ref,
                )
            )
            await s.commit()

    async def test_webhook_cancelled_respeita_cancelamento_agendado(
        self, client, monkeypatch
    ):
        """Webhook `preapproval cancelled` NÃO suspende quando o cancelamento foi
        agendado pelo usuário (cancelar_no_fim=True) — o acesso segue até periodo_fim."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        est_id = await _estudio_demo_id()
        await self._cobranca_preapproval(est_id, "preapp-cnf-1", "ref-cnf-1")
        # Estado pós-/cancelar: agendado + fim do ciclo já gravado.
        fim = datetime.now(UTC) + timedelta(days=10)
        await _set_assinatura(
            est_id, status=StatusAssinatura.ATIVA, cancelar_no_fim=True, periodo_fim=fim
        )

        async def fake_obter(_pid):
            return {"status": "cancelled", "external_reference": "ref-cnf-1"}

        monkeypatch.setattr(pr.gateway, "obter_preapproval", fake_obter)

        w = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "preapproval", "data": {"id": "preapp-cnf-1"}},
        )
        assert w.status_code == 200
        async with async_session() as s:
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            # Cancelamento do usuário → NÃO suspende; segue ATIVA (acesso até periodo_fim).
            assert ass.status == StatusAssinatura.ATIVA

    async def test_webhook_cancelled_por_falha_suspende(self, client, monkeypatch):
        """Regressão: sem cancelamento agendado (falha de cobrança), o webhook
        `preapproval cancelled` continua SUSPENDENDO (proteção de receita)."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        est_id = await _estudio_demo_id()
        await self._cobranca_preapproval(est_id, "preapp-fail-1", "ref-fail-1")
        # ATIVA, SEM cancelamento agendado (falha de cobrança no MP).
        await _set_assinatura(
            est_id, status=StatusAssinatura.ATIVA, cancelar_no_fim=False, periodo_fim=None
        )

        async def fake_obter(_pid):
            return {"status": "cancelled", "external_reference": "ref-fail-1"}

        monkeypatch.setattr(pr.gateway, "obter_preapproval", fake_obter)

        w = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "preapproval", "data": {"id": "preapp-fail-1"}},
        )
        assert w.status_code == 200
        async with async_session() as s:
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            assert ass.status == StatusAssinatura.SUSPENSA

    async def test_avulso_sem_preapproval_marca_local_sem_chamar_mp(
        self, autenticado, monkeypatch
    ):
        from app.api.v1.pagamentos import router as pr

        est_id = await _estudio_demo_id()
        await _set_assinatura(
            est_id,
            status=StatusAssinatura.ATIVA,
            ciclo="anual",
            externo_id=None,
            cancelar_no_fim=False,
            periodo_fim=datetime.now(UTC) + timedelta(days=200),
        )

        chamadas: list[str] = []

        async def fake_cancelar(preapproval_id):
            chamadas.append(preapproval_id)
            return {}

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)
        monkeypatch.setattr(pr.gateway, "cancelar_preapproval", fake_cancelar)

        r = await autenticado.post("/api/v1/pagamentos/cancelar")
        assert r.status_code == 200, r.text
        assert r.json()["cancelar_no_fim"] is True
        # Avulso não tem recorrência no gateway → nada a cancelar no MP.
        assert chamadas == []

        async with async_session() as s:
            ass = await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id))
            assert ass.cancelar_no_fim is True
            assert ass.status == StatusAssinatura.ATIVA
