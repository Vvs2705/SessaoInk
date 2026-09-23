"""Integração — enforcement de assinatura (402 nas rotas de negócio).

Cada teste cria um estúdio isolado com a assinatura no estado desejado e
verifica o comportamento das rotas de negócio (bloqueiam) e isentas (nunca 402).
"""

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session
from app.core.security import hash_senha
from app.models.saas import Assinatura, Cobranca, StatusAssinatura
from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.services.assinatura import CARENCIA_DIAS

SENHA = "admin123"

ROTA_NEGOCIO = "/api/v1/clientes/"
ROTAS_ISENTAS = [
    "/api/v1/pagamentos/assinatura",
    "/api/v1/pagamentos/config",
    "/api/v1/lgpd/exportar",
    "/api/v1/auth/me",
    "/api/v1/usuarios/me",
    "/api/v1/estudio/",
]


async def _novo_estudio(assinatura_campos: dict | None) -> str:
    """Cria estúdio + ADMIN (+ assinatura, se campos dados); retorna o e-mail."""
    sufixo = uuid.uuid4().hex[:8]
    async with async_session() as session:
        estudio = Estudio(
            nome=f"Enforcement {sufixo}",
            slug=f"enf-{sufixo}",
            # O checkout exige dados fiscais completos (NFS-e); sem eles a
            # criação de cobrança responde 422 antes de chegar ao gateway.
            documento="40204602000185",
            razao_social=f"Enforcement {sufixo} LTDA",
            endereco_cep="07749220",
            endereco_logradouro="Rua Vicente Lisa",
            endereco_numero="6281",
            endereco_bairro="Vila Rosina",
            endereco_cidade="Caieiras",
            endereco_uf="SP",
        )
        session.add(estudio)
        await session.flush()
        admin = Usuario(
            estudio_id=estudio.id,
            nome="Admin Enforcement",
            email=f"enf-{sufixo}@sessaoink.dev",
            senha_hash=hash_senha(SENHA),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(admin)
        if assinatura_campos is not None:
            session.add(Assinatura(estudio_id=estudio.id, **assinatura_campos))
        await session.commit()
        return admin.email


async def _login(client: AsyncClient, email: str) -> AsyncClient:
    r = await client.post("/api/v1/auth/login", json={"email": email, "senha": SENHA})
    assert r.status_code == 200, f"Falha login: {r.text}"
    return client


class TestBloqueio402:
    async def test_trial_vigente_libera(self, client: AsyncClient):
        email = await _novo_estudio(
            {
                "status": StatusAssinatura.TRIAL,
                "trial_expira_em": datetime.now(UTC) + timedelta(days=10),
            }
        )
        await _login(client, email)
        r = await client.get(ROTA_NEGOCIO)
        assert r.status_code == 200, r.text

    async def test_trial_expirado_bloqueia_402(self, client: AsyncClient):
        email = await _novo_estudio(
            {
                "status": StatusAssinatura.TRIAL,
                "trial_expira_em": datetime.now(UTC) - timedelta(days=1),
            }
        )
        await _login(client, email)
        r = await client.get(ROTA_NEGOCIO)
        assert r.status_code == 402, r.text
        detail = r.json()["detail"]
        assert detail["motivo"] == "trial_expirado"
        assert "mensagem" in detail

        # ADMIN e não-ADMIN igualmente bloqueados: dashboard também 402.
        r2 = await client.get("/api/v1/dashboard/resumo")
        assert r2.status_code == 402

    async def test_ativa_sem_periodo_fim_libera(self, client: AsyncClient):
        email = await _novo_estudio({"status": StatusAssinatura.ATIVA, "periodo_fim": None})
        await _login(client, email)
        r = await client.get(ROTA_NEGOCIO)
        assert r.status_code == 200, r.text

    async def test_ativa_com_periodo_fim_passado_bloqueia_402(self, client: AsyncClient):
        email = await _novo_estudio(
            {
                "status": StatusAssinatura.ATIVA,
                "periodo_inicio": datetime.now(UTC) - timedelta(days=100),
                "periodo_fim": datetime.now(UTC) - timedelta(days=1),
            }
        )
        await _login(client, email)
        r = await client.get(ROTA_NEGOCIO)
        assert r.status_code == 402, r.text
        assert r.json()["detail"]["motivo"] == "assinatura_expirada"

    async def test_suspensa_e_cancelada_bloqueiam_402(self, client: AsyncClient):
        for status_, motivo in [
            (StatusAssinatura.SUSPENSA, "suspensa"),
            (StatusAssinatura.CANCELADA, "cancelada"),
        ]:
            email = await _novo_estudio({"status": status_})
            client.cookies.clear()
            await _login(client, email)
            r = await client.get(ROTA_NEGOCIO)
            assert r.status_code == 402, f"{status_}: {r.text}"
            assert r.json()["detail"]["motivo"] == motivo

    async def test_sem_assinatura_bloqueia_402(self, client: AsyncClient):
        email = await _novo_estudio(None)
        await _login(client, email)
        r = await client.get(ROTA_NEGOCIO)
        assert r.status_code == 402
        assert r.json()["detail"]["motivo"] == "sem_assinatura"


class TestRotasIsentas:
    async def test_rotas_isentas_nunca_402_mesmo_bloqueado(self, client: AsyncClient):
        """Bloqueado precisa conseguir: pagar, exportar dados (LGPD) e ver config."""
        email = await _novo_estudio(
            {
                "status": StatusAssinatura.TRIAL,
                "trial_expira_em": datetime.now(UTC) - timedelta(days=1),
            }
        )
        await _login(client, email)
        for rota in ROTAS_ISENTAS:
            r = await client.get(rota)
            assert r.status_code != 402, f"{rota} devolveu 402: {r.text}"
            assert r.status_code == 200, f"{rota}: {r.text}"


class TestAtivacaoEscrevePeriodo:
    async def test_webhook_trimestral_escreve_periodo_fim_e_desbloqueia(
        self, client: AsyncClient, monkeypatch
    ):
        """Estúdio com trial expirado (402) paga um trimestre via checkout →
        webhook ativa e grava periodo_fim ≈ +3 meses + carência → volta a 200."""
        from app.api.v1.pagamentos import router as pr

        email = await _novo_estudio(
            {
                "status": StatusAssinatura.TRIAL,
                "trial_expira_em": datetime.now(UTC) - timedelta(days=1),
            }
        )
        await _login(client, email)
        assert (await client.get(ROTA_NEGOCIO)).status_code == 402

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-enf", "init_point": "https://mp/enf"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)

        # Checkout é rota ISENTA — o bloqueado precisa poder pagar.
        r = await client.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "trimestral"},
        )
        assert r.status_code == 201, r.text
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
            "/api/v1/pagamentos/webhook",
            json={"type": "payment", "data": {"id": f"pay-enf-{uuid.uuid4().hex[:8]}"}},
        )
        assert w.status_code == 200

        agora = datetime.now(UTC)
        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            ass = await s.scalar(
                select(Assinatura).where(Assinatura.estudio_id == cob.estudio_id)
            )
            assert ass.status == StatusAssinatura.ATIVA
            assert ass.periodo_inicio is not None
            fim = ass.periodo_fim
            assert fim is not None
            if fim.tzinfo is None:  # SQLite devolve naive
                fim = fim.replace(tzinfo=UTC)
            # ≈ +3 meses (89–93 dias) + carência de CARENCIA_DIAS
            dias = (fim - agora).days
            assert 89 + CARENCIA_DIAS - 1 <= dias <= 93 + CARENCIA_DIAS

        # Desbloqueado: rota de negócio volta a responder 200.
        assert (await client.get(ROTA_NEGOCIO)).status_code == 200

    async def test_webhook_preapproval_mensal_fica_sem_periodo_fim(
        self, client: AsyncClient, monkeypatch
    ):
        """Mensal recorrente: ativa sem periodo_fim (o MP pausa na falha e o
        webhook suspende) — nunca expira sozinha por tempo."""
        from app.api.v1.pagamentos import router as pr

        email = await _novo_estudio(
            {
                "status": StatusAssinatura.TRIAL,
                "trial_expira_em": datetime.now(UTC) + timedelta(days=5),
            }
        )
        await _login(client, email)

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        ref = {}

        async def fake_assinatura(*, plano_slug, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "assinatura", "id": f"preapp-enf-{uuid.uuid4().hex[:8]}", "init_point": "https://mp/sub"}

        monkeypatch.setattr(pr.gateway, "criar_assinatura", fake_assinatura)
        r = await client.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        assert r.status_code == 201, r.text
        cob_ref = ref["v"]

        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            esperado = cob.valor_centavos
            preapp_id = cob.gateway_preapproval_id

        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_preapproval(_pid):
            return {
                "status": "authorized",
                "external_reference": cob_ref,
                "auto_recurring": {"transaction_amount": esperado / 100, "currency_id": "BRL"},
            }

        monkeypatch.setattr(pr.gateway, "obter_preapproval", fake_preapproval)
        w = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "preapproval", "data": {"id": preapp_id}},
        )
        assert w.status_code == 200

        async with async_session() as s:
            cob = await s.scalar(select(Cobranca).where(Cobranca.external_reference == cob_ref))
            ass = await s.scalar(
                select(Assinatura).where(Assinatura.estudio_id == cob.estudio_id)
            )
            assert ass.status == StatusAssinatura.ATIVA
            assert ass.periodo_inicio is not None
            assert ass.periodo_fim is None
