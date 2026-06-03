from httpx import AsyncClient

from app.core.redis import MockRedis, get_redis
from tests.conftest import ADMIN_EMAIL, ADMIN_SENHA


class TestAuthPasswordReset:
    async def test_esqueci_senha_retorna_generico_mesmo_inexistente(self, client: AsyncClient):
        r = await client.post("/api/v1/auth/esqueci-senha", json={"email": "naoexiste@exemplo.com"})
        assert r.status_code == 202, r.text
        assert "enviaremos instruções" in r.json()["message"]

    async def test_esqueci_senha_e_resetar_senha_fluxo_sucesso(self, client: AsyncClient):
        # 1. Solicita link
        r_esqueci = await client.post("/api/v1/auth/esqueci-senha", json={"email": ADMIN_EMAIL})
        assert r_esqueci.status_code == 202

        # 2. Obtém token gerado no MockRedis
        mock = MockRedis()
        chaves = await mock.keys("reset_senha:*")
        assert len(chaves) == 1

        token = "token_de_teste_seguro_e_comprido_12345"
        from sqlalchemy import select

        from app.core.database import async_session
        from app.core.redis import RESET_SENHA_PREFIX, RESET_SENHA_TTL_SEGUNDOS
        from app.core.security import hash_refresh_token
        from app.models.usuario import Usuario

        async with async_session() as session:
            db_user = await session.scalar(select(Usuario).where(Usuario.email == ADMIN_EMAIL))
            assert db_user is not None

            async with get_redis() as r:
                await r.set(
                    f"{RESET_SENHA_PREFIX}{hash_refresh_token(token)}",
                    str(db_user.id),
                    ex=RESET_SENHA_TTL_SEGUNDOS,
                )

        # 3. Executa o reset de senha com a nova senha
        nova_senha = "novasenhaforte123"
        r_reset = await client.post(
            "/api/v1/auth/resetar-senha",
            json={"token": token, "senha_nova": nova_senha},
        )
        assert r_reset.status_code == 204

        # 4. Tenta logar com a senha antiga (deve falhar)
        r_login_antigo = await client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "senha": ADMIN_SENHA},
        )
        assert r_login_antigo.status_code == 401

        # 5. Tenta logar com a senha nova (deve passar)
        r_login_novo = await client.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "senha": nova_senha},
        )
        assert r_login_novo.status_code == 200

        # Restaura a senha antiga para não quebrar outros testes da suíte
        from app.core.security import hash_senha
        async with async_session() as session:
            db_user = await session.scalar(select(Usuario).where(Usuario.email == ADMIN_EMAIL))
            if db_user:
                db_user.senha_hash = hash_senha(ADMIN_SENHA)
                await session.commit()

    async def test_resetar_senha_token_invalido_retorna_400(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/auth/resetar-senha",
            json={"token": "token_inexistente_com_comprimento_suficiente", "senha_nova": "novasenhaforte123"},
        )
        assert r.status_code == 400
        assert "inválido ou expirado" in r.json()["detail"]

    async def test_esqueci_senha_rate_limit(self, client: AsyncClient):
        # Limita solicitações consecutivas do mesmo IP
        mock = MockRedis()
        # Limpa chaves de rate limit de reset
        chaves = await mock.keys("reset_senha_rate:*")
        if chaves:
            await mock.delete(*chaves)

        for _ in range(5):
            r = await client.post("/api/v1/auth/esqueci-senha", json={"email": ADMIN_EMAIL})
            assert r.status_code == 202

        # A sexta tentativa deve dar 429
        r_blocked = await client.post("/api/v1/auth/esqueci-senha", json={"email": ADMIN_EMAIL})
        assert r_blocked.status_code == 429
