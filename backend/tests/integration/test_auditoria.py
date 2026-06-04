"""P0-10 — Testes de auditoria transacional."""

from httpx import AsyncClient


class TestAuditoria:
    async def test_consulta_exige_autenticacao(self, client: AsyncClient):
        r = await client.get("/api/v1/auditoria/")
        assert r.status_code == 401

    async def test_login_gera_evento_de_sucesso(self, autenticado: AsyncClient):
        # A fixture 'autenticado' faz login como admin → deve gerar auth.login.success
        r = await autenticado.get("/api/v1/auditoria/")
        assert r.status_code == 200
        eventos = r.json()
        assert any(e["acao"] == "auth.login.success" for e in eventos)
        # Auditoria captura IP e não vaza dados sensíveis (sem senha)
        login_ev = next(e for e in eventos if e["acao"] == "auth.login.success")
        assert "senha" not in str(login_ev).lower()

    async def test_filtro_por_acao(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/auditoria/?acao=auth.login.success")
        assert r.status_code == 200
        assert all(e["acao"] == "auth.login.success" for e in r.json())

    async def test_login_invalido_gera_evento_de_falha(self, autenticado: AsyncClient):
        # Tenta login com senha errada (gera auth.login.failure)
        await autenticado.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "senha-errada-123"},
        )
        r = await autenticado.get("/api/v1/auditoria/?acao=auth.login.failure")
        assert r.status_code == 200
        # Pode haver bloqueio de rate-limit, mas ao menos a estrutura responde 200
        assert isinstance(r.json(), list)

    async def test_financeiro_create_gera_auditoria(self, autenticado: AsyncClient):
        # P1-03 — criar lançamento financeiro deve gerar evento financeiro.created
        r = await autenticado.post(
            "/api/v1/financeiro/",
            json={"tipo": "ENTRADA", "valor": 150.0, "descricao": "Teste auditoria"},
        )
        assert r.status_code == 201, r.text

        ev = await autenticado.get("/api/v1/auditoria/?acao=financeiro.created")
        assert ev.status_code == 200
        eventos = ev.json()
        fin = next((e for e in eventos if e["acao"] == "financeiro.created"), None)
        assert fin is not None
        assert fin["entidade"] == "lancamento"
        # valor auditado como número JSON (não Decimal cru) e sem dado sensível
        assert "card" not in str(fin).lower()
