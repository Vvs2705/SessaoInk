"""Testes de integração — cadastro self-serve + status de assinatura (trial)."""

import uuid
from unittest.mock import AsyncMock

from httpx import AsyncClient

from app.core.config import settings
from app.core.redis import MockRedis


async def _zerar_signup_limit() -> None:
    """MockRedis não expira TTL — zera o contador de signup por IP entre testes."""
    mock = MockRedis()
    chaves = await mock.keys("signup_limit:*")
    if chaves:
        await mock.delete(*chaves)


def _dados(**over):
    sufixo = uuid.uuid4().hex[:8]
    base = {
        "nome_estudio": f"Estúdio {sufixo}",
        "nome": "Dono do Estúdio",
        "email": f"dono_{sufixo}@exemplo.com",
        "senha": "SenhaForte123!",
    }
    base.update(over)
    return base


class TestCadastro:
    async def test_registrar_cria_estudio_admin_e_trial(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/registrar", json=_dados())
        assert r.status_code == 201, r.text
        assert r.json()["mfa_required"] is False

        # Já está logado (cookies setados) — /me funciona
        me = await client.get("/api/v1/auth/me")
        assert me.status_code == 200
        assert me.json()["tipo"] == "ADMIN"

        # Trial criado: Profissional, ~14 dias
        ass = await client.get("/api/v1/pagamentos/assinatura")
        assert ass.status_code == 200, ass.text
        body = ass.json()
        assert body["status"] == "TRIAL"
        assert body["plano_slug"] == "profissional"
        assert body["trial"] is True
        assert body["acesso_liberado"] is True
        assert body["dias_restantes_trial"] is not None and body["dias_restantes_trial"] >= 1

    async def test_email_duplicado_retorna_409(self, client: AsyncClient):
        dados = _dados()
        r1 = await client.post("/api/v1/auth/registrar", json=dados)
        assert r1.status_code == 201
        r2 = await client.post("/api/v1/auth/registrar", json={**dados, "nome_estudio": "Outro"})
        assert r2.status_code == 409

    async def test_honeypot_descarta_silenciosamente(self, client: AsyncClient):
        dados = _dados(website="http://spam.com")
        r = await client.post("/api/v1/auth/registrar", json=dados)
        assert r.status_code == 201
        # Não logou (honeypot não emite sessão) → /me deve dar 401
        me = await client.get("/api/v1/auth/me")
        assert me.status_code == 401

    async def test_senha_curta_422(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/registrar", json=_dados(senha="123"))
        assert r.status_code == 422

    async def test_senha_sem_complexidade_422(self, client: AsyncClient):
        # Longa (13 chars) mas sem maiúscula nem caractere especial → rejeitada.
        r = await client.post(
            "/api/v1/auth/registrar", json=_dados(senha="senhaforte123")
        )
        assert r.status_code == 422

    async def test_senha_forte_aceita(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/auth/registrar", json=_dados(senha="SenhaF0rte!")
        )
        assert r.status_code == 201, r.text

    async def test_slug_unico_para_nomes_iguais(self, client: AsyncClient):
        # Dois cadastros com o MESMO nome de estúdio (e-mails diferentes).
        # Se o slug não fosse único, o 2º insert quebraria (UNIQUE) → 500.
        nome = f"Estudio Colisao {uuid.uuid4().hex[:6]}"
        r1 = await client.post("/api/v1/auth/registrar", json=_dados(nome_estudio=nome))
        r2 = await client.post("/api/v1/auth/registrar", json=_dados(nome_estudio=nome))
        assert r1.status_code == 201, r1.text
        assert r2.status_code == 201, r2.text


class TestEmailBoasVindas:
    async def test_cadastro_agenda_email_boas_vindas(
        self, client: AsyncClient, monkeypatch
    ):
        """O cadastro dispara o agendamento do e-mail de boas-vindas (background)."""
        await _zerar_signup_limit()
        spy = AsyncMock()
        monkeypatch.setattr("app.api.v1.auth.router.enviar_boas_vindas", spy)

        dados = _dados()
        r = await client.post("/api/v1/auth/registrar", json=dados)
        assert r.status_code == 201, r.text

        spy.assert_awaited_once()
        kwargs = spy.await_args.kwargs
        assert kwargs["destinatario_email"] == dados["email"].lower()
        assert kwargs["nome"] == dados["nome"]
        assert kwargs["nome_estudio"] == dados["nome_estudio"]
        assert kwargs["slug"]

    async def test_falha_no_envio_nao_quebra_cadastro(
        self, client: AsyncClient, monkeypatch
    ):
        """Resend indisponível/erro no envio não pode derrubar o cadastro (segue 201)."""
        await _zerar_signup_limit()
        # Força o caminho de envio real (Resend "configurado") e faz o send explodir.
        monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
        monkeypatch.setattr(
            "app.core.email._enviar_sync",
            lambda *a, **k: (_ for _ in ()).throw(RuntimeError("resend caiu")),
        )

        r = await client.post("/api/v1/auth/registrar", json=_dados())
        assert r.status_code == 201, r.text


class TestStatusAssinatura:
    async def test_assinatura_sem_auth_401(self, client: AsyncClient):
        r = await client.get("/api/v1/pagamentos/assinatura")
        assert r.status_code == 401
