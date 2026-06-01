"""Testes da defesa CSRF double-submit."""

from httpx import AsyncClient


def _csrf_token(client: AsyncClient) -> str:
    token = client.cookies.get("csrf_token")
    assert token
    return token


class TestCSRFDuploSubmit:
    async def test_login_define_cookie_csrf_nao_httponly(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )

        assert r.status_code == 200
        assert "csrf_token" in r.cookies
        set_cookie = "\n".join(v for k, v in r.headers.multi_items() if k == "set-cookie")
        assert "csrf_token=" in set_cookie
        assert "HttpOnly" not in next(
            value for key, value in r.headers.multi_items()
            if key == "set-cookie" and value.startswith("csrf_token=")
        )

    async def test_mutacao_com_cookie_csrf_sem_header_retorna_403(
        self,
        client: AsyncClient,
        monkeypatch,
    ):
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert login.status_code == 200
        assert _csrf_token(client)
        monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.settings.ALLOWED_ORIGINS", ["http://test"])

        r = await client.post(
            "/api/v1/clientes/",
            headers={"X-Origin-Browser": "http://test"},
            json={"nome": "Cliente sem CSRF"},
        )

        assert r.status_code == 403
        assert r.json()["detail"] == "Token CSRF inválido"

    async def test_mutacao_com_cookie_e_header_csrf_valido_passa(
        self,
        client: AsyncClient,
        monkeypatch,
    ):
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@sessaoink.dev", "senha": "admin123"},
        )
        assert login.status_code == 200
        token = _csrf_token(client)
        monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.settings.ALLOWED_ORIGINS", ["http://test"])

        r = await client.post(
            "/api/v1/clientes/",
            headers={
                "X-Origin-Browser": "http://test",
                "X-CSRF-Token": token,
            },
            json={"nome": "Cliente com CSRF"},
        )

        assert r.status_code == 201, r.text

    async def test_modo_estrito_sem_cookie_csrf_retorna_403(
        self,
        autenticado: AsyncClient,
        monkeypatch,
    ):
        monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.settings.ALLOWED_ORIGINS", ["http://test"])
        autenticado.cookies.delete("csrf_token")

        r = await autenticado.post(
            "/api/v1/clientes/",
            headers={"X-Origin-Browser": "http://test"},
            json={"nome": "Cliente sem cookie CSRF"},
        )

        assert r.status_code == 403
        assert r.json()["detail"].startswith("Token CSRF")

    async def test_token_servico_lgpd_dispensa_csrf_browser(
        self,
        client: AsyncClient,
        monkeypatch,
    ):
        monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.settings.LGPD_RETENTION_TOKEN", "service-token-123")

        r = await client.post(
            "/api/v1/admin/lgpd/anonimizar",
            headers={"Authorization": "Bearer service-token-123"},
            json={"dry_run": True},
        )

        assert r.status_code == 200, r.text

    async def test_origin_parecido_com_prefixo_autorizado_e_bloqueado(
        self,
        client: AsyncClient,
        monkeypatch,
    ):
        monkeypatch.setattr("app.main.settings.ENVIRONMENT", "production")
        monkeypatch.setattr("app.main.settings.ALLOWED_ORIGINS", ["https://sessaoink.com.br"])

        r = await client.post(
            "/api/v1/clientes/",
            headers={"X-Origin-Browser": "https://sessaoink.com.br.evil.test"},
            json={"nome": "Cliente origem maliciosa"},
        )

        assert r.status_code == 403
        assert r.json()["detail"] == "Origem não autorizada"
