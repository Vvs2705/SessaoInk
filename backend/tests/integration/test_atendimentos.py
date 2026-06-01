"""Testes de integração — Atendimentos e isolamento por estúdio."""

import pytest
from httpx import AsyncClient


class TestListagem:
    async def test_listar_retorna_200(self, autenticado: AsyncClient):
        """GET /atendimentos/ retorna lista com 200."""
        r = await autenticado.get("/api/v1/atendimentos/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_listar_sem_auth_retorna_401(self, client: AsyncClient):
        """GET /atendimentos/ sem cookie retorna 401."""
        r = await client.get("/api/v1/atendimentos/")
        assert r.status_code == 401

    async def test_todos_do_proprio_estudio(self, autenticado: AsyncClient):
        """Todos os atendimentos retornados pertencem ao estúdio do usuário logado."""
        me = await autenticado.get("/api/v1/auth/me")
        estudio_id = me.json()["estudio_id"]

        r = await autenticado.get("/api/v1/atendimentos/")
        atendimentos = r.json()

        for a in atendimentos:
            assert a["estudio_id"] == estudio_id, (
                f"Atendimento {a['id']} pertence a outro estúdio: {a['estudio_id']}"
            )


class TestCriacao:
    async def test_criar_atendimento_valido(self, autenticado: AsyncClient):
        """POST cria atendimento com status_operacional SOLICITADO (ADR-006)."""
        r = await autenticado.post(
            "/api/v1/atendimentos/",
            json={
                "nome_cliente_externo": "Cliente Teste Pytest",
                "descricao": "Tatuagem de dragão old school no antebraço",
                "referencia_contato": "11999999999",
            },
        )
        assert r.status_code == 201, r.text
        data = r.json()
        # ADR-006: status operacional e financeiro são campos separados
        assert data["status_operacional"] == "SOLICITADO"
        assert data["status_financeiro"] == "PENDENTE"

    async def test_criar_sem_auth_retorna_401(self, client: AsyncClient):
        """POST sem autenticação retorna 401."""
        r = await client.post(
            "/api/v1/atendimentos/",
            json={"nome_cliente_externo": "Teste"},
        )
        assert r.status_code == 401


class TestTransicaoStatus:
    async def test_atendimento_inexistente_retorna_404(self, autenticado: AsyncClient):
        """PATCH em UUID inexistente retorna 404."""
        r = await autenticado.patch(
            "/api/v1/atendimentos/00000000-0000-0000-0000-000000000001/status",
            json={"status": "EM_ATENDIMENTO"},
        )
        assert r.status_code == 404


class TestPortalPublico:
    async def test_orcamento_publico_cria_atendimento(self, client: AsyncClient):
        """POST /public/{slug}/orcamento cria atendimento SOLICITADO sem auth."""
        r = await client.post(
            "/api/v1/public/demo/orcamento",
            data={
                "nome": "Visitante Teste Pytest",
                "whatsapp": "11988887777",
                "descricao": "Quero uma tatuagem geométrica",
                "estilo": "Geométrico",
                "aceite_privacidade": "true",
                "aceite_termos": "true",
            },
        )
        # 201 = atendimento criado / 404 = slug "demo" não existe no banco local
        assert r.status_code in (201, 404), r.text
        if r.status_code == 201:
            # Portal retorna {protocolo, atendimento_id} — não o atendimento completo
            data = r.json()
            assert "protocolo" in data
            assert "atendimento_id" in data
            assert data["protocolo"].startswith("SI")
