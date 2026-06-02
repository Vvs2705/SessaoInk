"""Testes de integração — MFA (TOTP + e-mail OTP)."""

import uuid

import pyotp
from httpx import AsyncClient

from app.core.database import async_session
from app.core.security import hash_senha
from app.models.usuario import TipoUsuario, Usuario

SENHA = "mfa-user-123"


async def _criar_usuario_mfa(estudio_id: uuid.UUID) -> tuple[uuid.UUID, str]:
    email = f"mfa_{uuid.uuid4().hex[:8]}@sessaoink.dev"
    async with async_session() as session:
        u = Usuario(
            estudio_id=estudio_id,
            nome="Usuário MFA",
            email=email,
            senha_hash=hash_senha(SENHA),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(u)
        await session.commit()
        await session.refresh(u)
        return u.id, email


async def _estudio_id(client: AsyncClient) -> uuid.UUID:
    me = await client.get("/api/v1/auth/me")
    return uuid.UUID(me.json()["estudio_id"])


class TestTotp:
    async def test_setup_ativar_e_login_com_totp(self, autenticado: AsyncClient, client: AsyncClient):
        estudio_id = await _estudio_id(autenticado)
        _, email = await _criar_usuario_mfa(estudio_id)

        # Login do novo usuário (sem MFA ainda) → sessão direta
        login1 = await client.post(
            "/api/v1/auth/login", json={"email": email, "senha": SENHA}
        )
        assert login1.status_code == 200, login1.text
        assert login1.json()["mfa_required"] is False

        # Setup TOTP
        setup = await client.post("/api/v1/auth/mfa/totp/setup")
        assert setup.status_code == 200, setup.text
        secret = setup.json()["secret"]
        assert setup.json()["qr_code"].startswith("data:image/png;base64,")

        # Ativar com código válido
        codigo = pyotp.TOTP(secret).now()
        ativar = await client.post(
            "/api/v1/auth/mfa/totp/ativar", json={"codigo": codigo}
        )
        assert ativar.status_code == 204, ativar.text

        # /me reflete o status
        me = await client.get("/api/v1/auth/me")
        assert me.json()["mfa_totp_ativo"] is True

        # Novo login agora EXIGE 2º fator (retorna desafio, sem emitir sessão)
        login2 = await client.post(
            "/api/v1/auth/login", json={"email": email, "senha": SENHA}
        )
        assert login2.status_code == 200
        body = login2.json()
        assert body["mfa_required"] is True
        assert "totp" in body["metodos"]
        desafio = body["desafio"]
        assert desafio

        # Verificar com TOTP correto → emite sessão
        verificar = await client.post(
            "/api/v1/auth/mfa/verificar",
            json={"desafio": desafio, "codigo": pyotp.TOTP(secret).now(), "metodo": "totp"},
        )
        assert verificar.status_code == 200, verificar.text
        assert verificar.json()["mfa_required"] is False

    async def test_ativar_com_codigo_invalido_falha(self, autenticado: AsyncClient, client: AsyncClient):
        estudio_id = await _estudio_id(autenticado)
        _, email = await _criar_usuario_mfa(estudio_id)
        await client.post("/api/v1/auth/login", json={"email": email, "senha": SENHA})
        await client.post("/api/v1/auth/mfa/totp/setup")
        r = await client.post("/api/v1/auth/mfa/totp/ativar", json={"codigo": "000000"})
        assert r.status_code == 400

    async def test_verificar_desafio_invalido_401(self, client: AsyncClient):
        r = await client.post(
            "/api/v1/auth/mfa/verificar",
            json={"desafio": "inexistente", "codigo": "123456", "metodo": "totp"},
        )
        assert r.status_code == 401


class TestEmailOtp:
    async def test_login_com_email_otp(self, autenticado: AsyncClient, client: AsyncClient):
        estudio_id = await _estudio_id(autenticado)
        usuario_id, email = await _criar_usuario_mfa(estudio_id)

        await client.post("/api/v1/auth/login", json={"email": email, "senha": SENHA})
        ativar = await client.post("/api/v1/auth/mfa/email/ativar")
        assert ativar.status_code == 200
        assert ativar.json()["mfa_email_ativo"] is True

        # Novo login exige 2º fator
        login = await client.post(
            "/api/v1/auth/login", json={"email": email, "senha": SENHA}
        )
        body = login.json()
        assert body["mfa_required"] is True
        assert "email" in body["metodos"]
        desafio = body["desafio"]

        # Solicitar OTP — sem Resend nos testes o código ainda é persistido no Redis
        solicitar = await client.post(
            "/api/v1/auth/mfa/email/solicitar", json={"desafio": desafio}
        )
        assert solicitar.status_code == 202

        # Confirma que um OTP foi armazenado para o usuário
        from app.core.redis import MFA_OTP_PREFIX, get_redis, salvar_otp_email

        async with get_redis() as r:
            assert await r.get(f"{MFA_OTP_PREFIX}{usuario_id}") is not None

        # Força um código conhecido e verifica o fluxo de 2º fator por e-mail
        await salvar_otp_email(str(usuario_id), "654321")
        verificar = await client.post(
            "/api/v1/auth/mfa/verificar",
            json={"desafio": desafio, "codigo": "654321", "metodo": "email"},
        )
        assert verificar.status_code == 200, verificar.text
        assert verificar.json()["mfa_required"] is False
