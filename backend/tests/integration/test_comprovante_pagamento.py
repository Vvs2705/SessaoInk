"""Comprovante de pagamento — entrega única e guard fiscal do checkout.

A aprovação chega por 3 caminhos concorrentes (webhook payment, webhook
preapproval e /reconciliar). Sem a reserva atômica o cliente receberia o
comprovante — e, quando a NFS-e entrar, a própria nota — mais de uma vez.
"""

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.pagamentos.router import _reservar_comprovante
from app.core.database import async_session
from app.models.saas import Cobranca, StatusCobranca
from app.models.usuario import Estudio

DADOS_FISCAIS_OK = {
    "documento": "40204602000185",
    "razao_social": "VSTACK SOLUTIONS LTDA",
    "endereco_cep": "07749220",
    "endereco_logradouro": "Rua Vicente Lisa",
    "endereco_numero": "6281",
    "endereco_bairro": "Vila Rosina",
    "endereco_cidade": "Caieiras",
    "endereco_uf": "SP",
}


async def _estudio_demo_id() -> uuid.UUID:
    async with async_session() as s:
        est = await s.scalar(select(Estudio).where(Estudio.slug == "demo"))
        assert est is not None
        return est.id


async def _nova_cobranca(estudio_id: uuid.UUID) -> uuid.UUID:
    ref = uuid.uuid4().hex
    async with async_session() as s:
        cob = Cobranca(
            estudio_id=estudio_id,
            plano_slug="profissional",
            ciclo="mensal",
            valor_centavos=13500,
            status=StatusCobranca.CRIADA,
            external_reference=ref,
            idempotency_key=ref,
        )
        s.add(cob)
        await s.commit()
        return cob.id


class TestReservaDeComprovante:
    async def test_primeira_reserva_ganha_segunda_perde(self):
        """Chamar duas vezes = um único envio. É a defesa contra os 3 caminhos."""
        est_id = await _estudio_demo_id()
        cob_id = await _nova_cobranca(est_id)

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert cob is not None
            assert await _reservar_comprovante(s, cob) is True
            await s.commit()

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert cob is not None
            assert await _reservar_comprovante(s, cob) is False
            await s.commit()

    async def test_reserva_persiste_o_carimbo(self):
        est_id = await _estudio_demo_id()
        cob_id = await _nova_cobranca(est_id)

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert cob is not None
            assert cob.comprovante_enviado_em is None
            await _reservar_comprovante(s, cob)
            await s.commit()

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert cob is not None
            assert cob.comprovante_enviado_em is not None

    async def test_cobrancas_distintas_nao_se_bloqueiam(self):
        est_id = await _estudio_demo_id()
        a, b = await _nova_cobranca(est_id), await _nova_cobranca(est_id)
        async with async_session() as s:
            cob_a, cob_b = await s.get(Cobranca, a), await s.get(Cobranca, b)
            assert await _reservar_comprovante(s, cob_a) is True
            assert await _reservar_comprovante(s, cob_b) is True
            await s.commit()


async def _set_dados_fiscais(est_id: uuid.UUID, **campos) -> None:
    async with async_session() as s:
        est = await s.get(Estudio, est_id)
        assert est is not None
        for campo, valor in campos.items():
            setattr(est, campo, valor)
        await s.commit()


class TestGuardFiscalNoCheckout:
    async def test_checkout_recusa_sem_dados_fiscais(
        self, autenticado: AsyncClient, monkeypatch
    ):
        """Sem CPF/CNPJ a nota não pode ser emitida — barra antes de cobrar."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        est_id = await _estudio_demo_id()
        await _set_dados_fiscais(est_id, documento=None, razao_social=None)

        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        assert r.status_code == 422, r.text
        detail = r.json()["detail"]
        assert detail["codigo"] == "dados_fiscais_incompletos"
        assert "documento" in detail["campos"]
        assert "razao_social" in detail["campos"]

    async def test_checkout_passa_do_guard_com_dados_completos(
        self, autenticado: AsyncClient, monkeypatch
    ):
        """Com os dados completos o guard não barra — a falha seguinte já é do
        gateway (sem credencial no teste), não mais 422."""
        from app.api.v1.pagamentos import router as pr

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        est_id = await _estudio_demo_id()
        await _set_dados_fiscais(est_id, **DADOS_FISCAIS_OK)

        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "mensal"},
        )
        assert r.status_code != 422, r.text


class TestDadosFiscaisNoEstudio:
    async def test_patch_aceita_e_normaliza_documento(self, autenticado: AsyncClient):
        r = await autenticado.patch(
            "/api/v1/estudio/",
            json={"documento": "40.204.602/0001-85", "razao_social": "VSTACK SOLUTIONS LTDA"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["documento"] == "40204602000185"  # gravado sem máscara
        assert body["razao_social"] == "VSTACK SOLUTIONS LTDA"

    async def test_patch_recusa_documento_invalido(self, autenticado: AsyncClient):
        r = await autenticado.patch("/api/v1/estudio/", json={"documento": "111.111.111-11"})
        assert r.status_code == 400, r.text

    async def test_historico_responde_lista(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/pagamentos/historico")
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


class TestComprovanteNoWebhook:
    """Ponta a ponta: webhook aprova → comprovante sai uma única vez."""

    async def _preparar(self, autenticado, monkeypatch) -> tuple[str, int]:
        from app.api.v1.pagamentos import router as pr
        from app.models.saas import Assinatura, StatusAssinatura

        monkeypatch.setattr(pr.settings, "PAGAMENTOS_GO_LIVE", True)
        est_id = await _estudio_demo_id()
        await _set_dados_fiscais(est_id, **DADOS_FISCAIS_OK)

        async with async_session() as s:
            if not await s.scalar(select(Assinatura).where(Assinatura.estudio_id == est_id)):
                s.add(Assinatura(estudio_id=est_id, status=StatusAssinatura.TRIAL))
                await s.commit()

        ref = {}

        async def fake_unica(*, plano_slug, ciclo, email_pagador, referencia):
            ref["v"] = referencia
            return {"tipo": "cobranca_unica", "id": "pref-c", "init_point": "https://mp/c"}

        monkeypatch.setattr(pr.gateway, "criar_cobranca_unica", fake_unica)
        r = await autenticado.post(
            "/api/v1/pagamentos/checkout",
            json={"plano_slug": "profissional", "ciclo": "semestral"},
        )
        assert r.status_code == 201, r.text

        async with async_session() as s:
            cob = await s.scalar(
                select(Cobranca).where(Cobranca.external_reference == ref["v"])
            )
            return ref["v"], cob.valor_centavos

    async def test_webhook_aprovado_envia_comprovante_uma_vez(
        self, autenticado: AsyncClient, client: AsyncClient, monkeypatch
    ):
        from app.api.v1.pagamentos import router as pr
        from app.core import email as email_mod

        cob_ref, esperado = await self._preparar(autenticado, monkeypatch)

        enviados: list[dict] = []

        def fake_enviar(destinatario, assunto, html, anexos=None):
            enviados.append({"para": destinatario, "assunto": assunto, "html": html})

        monkeypatch.setattr(email_mod, "_enviar_sync", fake_enviar)
        monkeypatch.setattr(email_mod, "_resend_configurado", lambda: True)
        monkeypatch.setattr(pr.gateway, "configurado", lambda: True)

        async def fake_obter(_pid):
            return {
                "status": "approved",
                "external_reference": cob_ref,
                "transaction_amount": esperado / 100,
                "payment_type_id": "bank_transfer",
                "payment_method_id": "pix",
                "currency_id": "BRL",
            }

        monkeypatch.setattr(pr.gateway, "obter_pagamento", fake_obter)

        w = await client.post(
            "/api/v1/pagamentos/webhook",
            json={"type": "payment", "data": {"id": "pay-comprov-1"}},
        )
        assert w.status_code == 200

        assert len(enviados) == 1, f"esperava 1 comprovante, veio {len(enviados)}"
        corpo = enviados[0]
        assert "Comprovante de pagamento" in corpo["assunto"]
        # Detalhamento exigido: valor, plano, documento e forma de pagamento.
        assert "Profissional" in corpo["html"]
        assert "40.204.602/0001-85" in corpo["html"]
        assert "Pix" in corpo["html"]
        assert "VSTACK SOLUTIONS LTDA" in corpo["html"]

        # Segunda passada pelo mesmo caminho (reconciliação ativa correndo junto
        # com o webhook) NÃO pode gerar um segundo comprovante.
        async with async_session() as s:
            cob = await s.scalar(
                select(Cobranca).where(Cobranca.external_reference == cob_ref)
            )
            await pr._agendar_comprovante(s, _BackgroundSpy(), cob, None, via="teste")
            await s.commit()

        assert len(enviados) == 1, "comprovante duplicado — a guarda não segurou"


class TestFalhaLiberaReserva:
    async def test_falha_no_preparo_libera_a_reserva(self, monkeypatch):
        """Se o preparo do comprovante falhar, a reserva é desfeita — senão o
        comprovante ficaria marcado como enviado sem nunca ter saído."""
        from app.api.v1.pagamentos import router as pr

        est_id = await _estudio_demo_id()
        cob_id = await _nova_cobranca(est_id)

        def explode(_slug):
            raise RuntimeError("falha simulada no preparo")

        monkeypatch.setattr(pr, "_nome_plano", explode)

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            await pr._agendar_comprovante(s, _BackgroundSpy(), cob, None, via="teste")
            await s.commit()

        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert cob.comprovante_enviado_em is None, "reserva ficou presa após falha"

        # Sem o monkeypatch, a tentativa seguinte consegue reservar de novo.
        async with async_session() as s:
            cob = await s.get(Cobranca, cob_id)
            assert await pr._reservar_comprovante(s, cob) is True
            await s.commit()


class _BackgroundSpy:
    """BackgroundTasks mínimo: executa a task na hora, para o teste observar."""

    def __init__(self):
        self.tarefas = []

    def add_task(self, func, *args, **kwargs):
        self.tarefas.append((func, args, kwargs))
