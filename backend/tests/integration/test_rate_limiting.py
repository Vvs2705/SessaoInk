"""Testes de integração — Rate limiting de login (ADR-009) + Estúdio."""

import pytest
from httpx import AsyncClient
from redis.asyncio import Redis

from app.core.config import settings


# ---------------------------------------------------------------------------
# Helpers Redis — usa scan para garantir limpeza independente do IP real
# ---------------------------------------------------------------------------


async def _limpar_todas_tentativas() -> None:
    """Remove TODAS as chaves login_fail:* do Redis."""
    async with Redis.from_url(settings.REDIS_URL, decode_responses=True) as r:
        chaves = await r.keys("login_fail:*")
        if chaves:
            await r.delete(*chaves)


async def _contar_todas_tentativas() -> int:
    """Conta total de tentativas de login em todos os IPs no Redis."""
    async with Redis.from_url(settings.REDIS_URL, decode_responses=True) as r:
        chaves = await r.keys("login_fail:*")
        return len(chaves)


async def _obter_ip_registrado() -> str | None:
    """Retorna o primeiro IP com chave de tentativa no Redis."""
    async with Redis.from_url(settings.REDIS_URL, decode_responses=True) as r:
        chaves = await r.keys("login_fail:*")
        if not chaves:
            return None
        return chaves[0].removeprefix("login_fail:")


async def _obter_contador(ip: str) -> int:
    async with Redis.from_url(settings.REDIS_URL, decode_responses=True) as r:
        val = await r.get(f"login_fail:{ip}")
        return int(val) if val else 0


# ---------------------------------------------------------------------------
# Fixture de limpeza automática — garante estado limpo antes/após cada teste
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
async def limpar_rate_limit():
    """Limpa estado de rate limiting antes e após cada teste neste módulo."""
    await _limpar_todas_tentativas()
    yield
    await _limpar_todas_tentativas()


# ---------------------------------------------------------------------------
# Testes de rate limiting
# ---------------------------------------------------------------------------


class TestRateLimiting:
    async def test_tentativa_incorreta_incrementa_contador(self, client: AsyncClient):
        """Cada login com senha errada deve incrementar o contador no Redis."""
        antes = await _contar_todas_tentativas()

        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "senhaerrada"},
        )
        assert r.status_code == 401

        # Deve ter aparecido pelo menos uma chave nova
        depois = await _contar_todas_tentativas()
        assert depois > antes or depois >= 1, (
            "Esperava que o contador de tentativas aumentasse após login com senha errada"
        )

        # Verifica que o IP registrado tem exatamente 1 tentativa
        ip = await _obter_ip_registrado()
        assert ip is not None, "Nenhuma chave de rate limiting encontrada no Redis"
        assert await _obter_contador(ip) == 1

    async def test_login_correto_zera_contador(self, client: AsyncClient):
        """Login bem-sucedido deve zerar o contador de tentativas do IP."""
        # 2 tentativas falhas primeiro
        for _ in range(2):
            r = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@sessaoink.dev", "senha": "errada"},
            )
            assert r.status_code == 401

        # Confirmar que há falhas registradas
        ip = await _obter_ip_registrado()
        assert ip is not None
        assert await _obter_contador(ip) == 2

        # Login correto
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 200, f"Login deveria ter sucesso: {r.text}"

        # Contador zerado após sucesso
        assert await _obter_contador(ip) == 0

        await client.post("/api/v1/auth/logout")

    async def test_bloqueio_apos_5_tentativas(self, client: AsyncClient):
        """Após 5 falhas consecutivas, login retorna 429."""
        # 5 tentativas com senha errada
        for i in range(5):
            r = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@sessaoink.dev", "senha": f"errada{i}"},
            )
            assert r.status_code == 401, (
                f"Tentativa {i + 1}: esperava 401 antes do bloqueio, recebeu {r.status_code}"
            )

        # 6ª tentativa — IP deve estar bloqueado (mesmo com senha correta)
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 429, (
            f"Esperava 429 (bloqueado por rate limiting), recebeu {r.status_code}"
        )
        assert "15 minutos" in r.json()["detail"]

    async def test_apos_limpeza_login_funciona(self, client: AsyncClient):
        """Simulação de expiração do TTL: após limpar bloqueio, login funciona."""
        # Garantir bloqueio com 5 falhas
        for _ in range(5):
            await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@sessaoink.dev", "senha": "errada"},
            )

        # Confirmar bloqueio
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 429

        # Simular expiração (limpeza manual como se o TTL tivesse expirado)
        await _limpar_todas_tentativas()

        # Login deve funcionar novamente
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 200, f"Após expiração do bloqueio, login deveria funcionar: {r.text}"

        await client.post("/api/v1/auth/logout")

    async def test_email_inexistente_tambem_conta(self, client: AsyncClient):
        """Tentativa com email inexistente também incrementa o contador."""
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "fantasma@sessaoink.dev", "senha": "qualquer"},
        )
        assert r.status_code == 401

        ip = await _obter_ip_registrado()
        assert ip is not None
        assert await _obter_contador(ip) >= 1


# ---------------------------------------------------------------------------
# Testes de Estúdio
# ---------------------------------------------------------------------------


class TestEstudio:
    async def test_obter_estudio_autenticado(self, autenticado: AsyncClient):
        """GET /estudio/ retorna dados do estúdio do usuário logado."""
        r = await autenticado.get("/api/v1/estudio/")
        assert r.status_code == 200
        data = r.json()
        assert "nome" in data
        assert "slug" in data
        assert "id" in data

    async def test_obter_estudio_sem_auth(self, client: AsyncClient):
        """GET /estudio/ sem autenticação retorna 401."""
        r = await client.get("/api/v1/estudio/")
        assert r.status_code == 401

    async def test_atualizar_estudio_admin(self, autenticado: AsyncClient):
        """PATCH /estudio/ por ADMIN deve atualizar campo bio."""
        r = await autenticado.patch(
            "/api/v1/estudio/",
            json={"bio": "Estúdio de tatuagem — bio atualizada pelo pytest"},
        )
        assert r.status_code == 200
        assert r.json()["bio"] == "Estúdio de tatuagem — bio atualizada pelo pytest"

    async def test_atualizar_estudio_sem_auth(self, client: AsyncClient):
        """PATCH /estudio/ sem autenticação retorna 401."""
        r = await client.patch("/api/v1/estudio/", json={"bio": "Teste"})
        assert r.status_code == 401

    async def test_listar_equipe(self, autenticado: AsyncClient):
        """GET /estudio/equipe retorna lista de membros com os campos corretos."""
        r = await autenticado.get("/api/v1/estudio/equipe")
        assert r.status_code == 200
        equipe = r.json()
        assert isinstance(equipe, list)
        assert len(equipe) >= 1
        for membro in equipe:
            assert "id" in membro
            assert "nome" in membro
            assert "email" in membro
            assert "tipo" in membro
