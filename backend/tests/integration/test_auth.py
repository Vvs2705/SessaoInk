"""Testes de integração — Autenticação e Redis."""

from httpx import AsyncClient

from app.core.redis import MockRedis, obter_usuario_do_refresh


def _extrair_refresh_cookie(response) -> str | None:
    """Extrai o valor de refresh_token de qualquer Set-Cookie header da resposta."""
    for _, valor in response.headers.multi_items():
        if "refresh_token=" in valor:
            for part in valor.split(";"):
                part = part.strip()
                if part.startswith("refresh_token="):
                    return part.split("=", 1)[1]
    return None




async def _contar_chaves_redis() -> int:
    """Conta quantas chaves refresh: existem no MockRedis singleton."""
    mock = MockRedis()  # singleton — mesmo objeto que a app usa
    return len(await mock.keys("refresh:*"))


class TestLogin:
    async def test_login_sucesso(self, client: AsyncClient):
        """Login com credenciais válidas retorna 200 e seta cookie de acesso."""
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 200
        assert "access_token" in r.cookies

    async def test_login_senha_errada(self, client: AsyncClient):
        """Senha errada retorna 401 com mensagem genérica."""
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "senhaerrada"},
        )
        assert r.status_code == 401
        assert "incorretos" in r.json()["detail"]

    async def test_login_email_inexistente(self, client: AsyncClient):
        """Email não cadastrado retorna 401 (mesma mensagem — não revela se email existe)."""
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "fantasma@sessaoink.dev", "senha": "qualquercoisa"},
        )
        assert r.status_code == 401
        assert "incorretos" in r.json()["detail"]

    async def test_login_salva_refresh_no_redis(self, client: AsyncClient):
        """Após login, deve existir pelo menos uma chave refresh: no Redis."""
        antes = await _contar_chaves_redis()

        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert r.status_code == 200

        depois = await _contar_chaves_redis()
        assert depois == antes + 1, (
            f"Esperava {antes + 1} chaves refresh no Redis, encontrou {depois}"
        )

        # Cleanup
        await client.post("/api/v1/auth/logout")


class TestMe:
    async def test_me_sem_auth(self, client: AsyncClient):
        """GET /auth/me sem cookie retorna 401."""
        r = await client.get("/api/v1/auth/me")
        assert r.status_code == 401

    async def test_me_autenticado(self, autenticado: AsyncClient):
        """GET /auth/me com sessão ativa retorna dados do usuário."""
        r = await autenticado.get("/api/v1/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@sessaoink.dev"
        assert data["tipo"] == "ADMIN"
        assert "senha" not in data
        assert "senha_hash" not in data


class TestLogout:
    async def test_logout_limpa_cookie(self, client: AsyncClient):
        """Logout retorna 204 e limpa o access_token."""
        await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        r = await client.post("/api/v1/auth/logout")
        assert r.status_code == 204

    async def test_logout_revoga_redis(self, client: AsyncClient):
        """Após logout, o número de chaves refresh: no Redis deve diminuir."""
        login_r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert login_r.status_code == 200

        # Extrair refresh_token de qualquer Set-Cookie header (path restrito)
        token = _extrair_refresh_cookie(login_r)
        assert token, "Cookie refresh_token não encontrado nos headers da resposta"

        # Confirmar que está no Redis
        assert await obter_usuario_do_refresh(token) is not None, (
            "Token não encontrado no Redis logo após login"
        )

        # Logout — define o cookie no client antes de enviar (path restrito impede envio automático)
        client.cookies.set("refresh_token", token)
        await client.post("/api/v1/auth/logout")
        client.cookies.delete("refresh_token")

        # Confirmar que foi revogado
        assert await obter_usuario_do_refresh(token) is None, (
            "Refresh token ainda existe no Redis após logout"
        )

    async def test_me_apos_logout_retorna_401(self, client: AsyncClient):
        """Após logout, /auth/me deve retornar 401."""
        await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        await client.post("/api/v1/auth/logout")
        r = await client.get("/api/v1/auth/me")
        assert r.status_code == 401
