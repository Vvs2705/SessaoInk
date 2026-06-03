"""Testes de integração — cadastro self-serve + status de assinatura (trial)."""

import uuid

from httpx import AsyncClient


def _dados(**over):
    sufixo = uuid.uuid4().hex[:8]
    base = {
        "nome_estudio": f"Estúdio {sufixo}",
        "nome": "Dono do Estúdio",
        "email": f"dono_{sufixo}@exemplo.com",
        "senha": "senhaforte123",
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

    async def test_slug_unico_para_nomes_iguais(self, client: AsyncClient):
        # Dois cadastros com o MESMO nome de estúdio (e-mails diferentes).
        # Se o slug não fosse único, o 2º insert quebraria (UNIQUE) → 500.
        nome = f"Estudio Colisao {uuid.uuid4().hex[:6]}"
        r1 = await client.post("/api/v1/auth/registrar", json=_dados(nome_estudio=nome))
        r2 = await client.post("/api/v1/auth/registrar", json=_dados(nome_estudio=nome))
        assert r1.status_code == 201, r1.text
        assert r2.status_code == 201, r2.text


class TestStatusAssinatura:
    async def test_assinatura_sem_auth_401(self, client: AsyncClient):
        r = await client.get("/api/v1/pagamentos/assinatura")
        assert r.status_code == 401
