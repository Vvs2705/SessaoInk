"""Router de autenticação — login, logout, refresh, me."""

import secrets
import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.api.v1.auth.schemas import (
    LoginRequest,
    LoginResponse,
    MfaAtivarRequest,
    MfaDesafioRequest,
    MfaDesativarRequest,
    MfaEmailToggleResponse,
    MfaSetupResponse,
    MfaVerificarRequest,
    SenhaAlterarRequest,
    TokenResponse,
    UsuarioResponse,
)
from app.core import mfa as mfa_core
from app.core.config import settings
from app.core.database import get_session
from app.core.email import enviar_codigo_mfa
from app.core.redis import (
    MFA_OTP_MAX_ENVIOS,
    incrementar_tentativa_login,
    limpar_tentativas_login,
    obter_usuario_do_desafio,
    obter_usuario_do_refresh,
    registrar_envio_otp,
    revogar_desafio_mfa,
    revogar_refresh_token,
    revogar_todas_sessoes_usuario,
    salvar_desafio_mfa,
    salvar_otp_email,
    salvar_refresh_token,
    verificar_bloqueio_login,
    verificar_otp_email,
)
from app.core.request_context import get_client_ip, get_user_agent
from app.core.security import (
    criar_access_token,
    criar_refresh_token,
    hash_senha,
    verificar_senha,
)
from app.models.usuario import Usuario
from app.services.audit import log_event

router = APIRouter(prefix="/auth", tags=["auth"])

# Configuração de cookies.
# SameSite=Lax em todos os ambientes: os cookies vivem em sessao-ink.vercel.app
# (mesmo domínio que o frontend), portanto a comunicação browser→proxy é
# same-site. O proxy encaminha os cookies ao backend via fetch server-to-server,
# sem envolvimento do browser. SameSite=Lax elimina CSRF nativamente sem precisar
# de tokens adicionais. Secure=True obrigatório em produção (exigido pelo browser
# para cookies usados em HTTPS).
_PRODUCTION = settings.ENVIRONMENT == "production"
COOKIE_SECURE = _PRODUCTION
COOKIE_SAMESITE = "lax"
ACCESS_COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
CSRF_COOKIE_MAX_AGE = REFRESH_COOKIE_MAX_AGE
CSRF_COOKIE_NAME = "csrf_token"


def _set_csrf_cookie(response: Response) -> str:
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=CSRF_COOKIE_MAX_AGE,
        path="/",
    )
    return token


def _delete_csrf_cookie(response: Response) -> None:
    response.delete_cookie(
        CSRF_COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        httponly=False,
    )


async def _emitir_sessao(response: Response, usuario: Usuario) -> None:
    """Gera access+refresh tokens, persiste o refresh no Redis e define os cookies.

    Reutilizado pelo login direto e pela verificação de 2º fator (MFA).
    """
    access_token = criar_access_token(
        data={
            "sub": str(usuario.id),
            "estudio_id": str(usuario.estudio_id),
            "role": usuario.tipo.value,
        }
    )
    refresh_token = criar_refresh_token()
    await salvar_refresh_token(
        token=refresh_token,
        usuario_id=str(usuario.id),
        ttl_dias=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_COOKIE_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth/refresh",
    )
    _set_csrf_cookie(response)


@router.post("/login", response_model=LoginResponse)
async def login(
    dados: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Autentica usuário e define cookies httpOnly.

    Rate limiting: 5 tentativas falhas por IP → bloqueio de 15 minutos (ADR-009).
    """
    # IP real do browser (via proxy Vercel/Fly) — não o IP do servidor Vercel.
    # Sem isso, o rate limit compartilharia o mesmo bucket para todos os usuários.
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # Verificar bloqueio por excesso de tentativas
    if await verificar_bloqueio_login(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
        )

    result = await session.execute(
        select(Usuario).where(
            Usuario.email == dados.email,
            Usuario.ativo,
        )
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verificar_senha(dados.senha, usuario.senha_hash):
        await incrementar_tentativa_login(ip)
        # Auditoria de falha (commit=True — persiste mesmo levantando 401 depois)
        await log_event(
            session,
            acao="auth.login.failure",
            estudio_id=usuario.estudio_id if usuario else None,
            actor_usuario_id=usuario.id if usuario else None,
            actor_tipo=usuario.tipo.value if usuario else None,
            entidade="usuario",
            ip=ip,
            user_agent=ua,
            dados={"email": dados.email},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    # Senha correta — zerar contador de tentativas
    await limpar_tentativas_login(ip)

    # 2º fator: se o usuário tem MFA ativo, NÃO emite sessão ainda.
    # Cria um desafio de curta duração e exige verificação do segundo fator.
    if usuario.mfa_ativo:
        desafio = await salvar_desafio_mfa(str(usuario.id))
        await log_event(
            session,
            acao="auth.mfa.challenge",
            estudio_id=usuario.estudio_id,
            actor_usuario_id=usuario.id,
            actor_tipo=usuario.tipo.value,
            entidade="usuario",
            entidade_id=str(usuario.id),
            ip=ip,
            user_agent=ua,
            dados={"metodos": usuario.mfa_metodos},
            commit=True,
        )
        return LoginResponse(
            message="Verificação em duas etapas necessária",
            mfa_required=True,
            metodos=usuario.mfa_metodos,
            desafio=desafio,
        )

    await log_event(
        session,
        acao="auth.login.success",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=ip,
        user_agent=ua,
        commit=True,
    )

    await _emitir_sessao(response, usuario)
    return LoginResponse()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
):
    """Invalida cookies e revoga refresh token no Redis."""
    if refresh_token:
        await revogar_refresh_token(refresh_token)

    response.delete_cookie(
        "access_token",
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        httponly=True,
    )
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth/refresh",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        httponly=True,
    )
    _delete_csrf_cookie(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Sair de todos os dispositivos — revoga TODAS as sessões do usuário."""
    await revogar_todas_sessoes_usuario(str(usuario.id))

    response.delete_cookie(
        "access_token",
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        httponly=True,
    )
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth/refresh",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        httponly=True,
    )
    _delete_csrf_cookie(response)


@router.get("/me", response_model=UsuarioResponse)
async def me(usuario: Usuario = Depends(get_usuario_atual)):
    """Retorna os dados do usuário autenticado."""
    return usuario


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Troca refresh_token por novo access_token (rotação de token)."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token não encontrado",
        )

    # Validar token no Redis
    usuario_id_str = await obter_usuario_do_refresh(refresh_token)
    if not usuario_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )

    try:
        usuario_id = uuid.UUID(usuario_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado",
        )

    # Buscar usuário no banco
    result = await session.execute(
        select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.ativo,
        )
    )
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo",
        )

    # Rotação: revogar token antigo e gerar novo par
    await revogar_refresh_token(refresh_token)

    novo_access = criar_access_token(
        data={
            "sub": str(usuario.id),
            "estudio_id": str(usuario.estudio_id),
            "role": usuario.tipo.value,
        }
    )
    novo_refresh = criar_refresh_token()
    await salvar_refresh_token(
        token=novo_refresh,
        usuario_id=str(usuario.id),
        ttl_dias=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )

    response.set_cookie(
        key="access_token",
        value=novo_access,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_COOKIE_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=novo_refresh,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/api/v1/auth/refresh",
    )
    _set_csrf_cookie(response)

    return TokenResponse()


@router.post("/alterar-senha", status_code=status.HTTP_204_NO_CONTENT)
async def alterar_senha(
    dados: SenhaAlterarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Altera a senha do usuário autenticado."""
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )

    if len(dados.senha_nova) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A nova senha deve ter pelo menos 8 caracteres",
        )

    usuario.senha_hash = hash_senha(dados.senha_nova)
    await session.commit()

    # Revogar todas as sessões ativas — um atacante que tenha comprometido
    # uma sessão anterior perde o acesso imediatamente após a troca de senha.
    await revogar_todas_sessoes_usuario(str(usuario.id))


# ---------------------------------------------------------------------------
# MFA — configuração (usuário autenticado)
# ---------------------------------------------------------------------------
@router.post("/mfa/totp/setup", response_model=MfaSetupResponse)
async def mfa_totp_setup(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Gera um segredo TOTP provisório e retorna a URI + QR Code para o app
    autenticador. O TOTP só passa a valer após `/mfa/totp/ativar`."""
    secret = mfa_core.gerar_secret_totp()
    usuario.mfa_totp_secret = secret
    await session.commit()
    uri = mfa_core.uri_provisionamento_totp(secret, usuario.email)
    return MfaSetupResponse(
        secret=secret, otpauth_uri=uri, qr_code=mfa_core.gerar_qr_base64(uri)
    )


@router.post("/mfa/totp/ativar", status_code=status.HTTP_204_NO_CONTENT)
async def mfa_totp_ativar(
    dados: MfaAtivarRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Confirma o TOTP validando um código do app autenticador."""
    if not usuario.mfa_totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Execute o setup do TOTP antes de ativar.",
        )
    if not mfa_core.verificar_totp(usuario.mfa_totp_secret, dados.codigo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Código TOTP inválido."
        )
    usuario.mfa_totp_ativo = True
    await session.commit()
    await log_event(
        session,
        acao="auth.mfa.totp.ativado",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        commit=True,
    )


@router.post("/mfa/totp/desativar", status_code=status.HTTP_204_NO_CONTENT)
async def mfa_totp_desativar(
    dados: MfaDesativarRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Desativa o TOTP (exige a senha do usuário, defesa contra sessão sequestrada)."""
    if not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Senha incorreta."
        )
    usuario.mfa_totp_ativo = False
    usuario.mfa_totp_secret = None
    await session.commit()
    await log_event(
        session,
        acao="auth.mfa.totp.desativado",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        commit=True,
    )


@router.post("/mfa/email/ativar", response_model=MfaEmailToggleResponse)
async def mfa_email_ativar(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Ativa o 2º fator por código enviado ao e-mail do usuário."""
    usuario.mfa_email_ativo = True
    await session.commit()
    return MfaEmailToggleResponse(mfa_email_ativo=True)


@router.post("/mfa/email/desativar", response_model=MfaEmailToggleResponse)
async def mfa_email_desativar(
    dados: MfaDesativarRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    if not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Senha incorreta."
        )
    usuario.mfa_email_ativo = False
    await session.commit()
    return MfaEmailToggleResponse(mfa_email_ativo=False)


# ---------------------------------------------------------------------------
# MFA — desafio de 2º fator durante o login (sem autenticação prévia)
# ---------------------------------------------------------------------------
async def _usuario_do_desafio(session: AsyncSession, desafio: str) -> Usuario:
    usuario_id_str = await obter_usuario_do_desafio(desafio)
    if not usuario_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Desafio de verificação inválido ou expirado.",
        )
    try:
        usuario_id = uuid.UUID(usuario_id_str)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Desafio de verificação inválido.",
        )
    usuario = await session.scalar(
        select(Usuario).where(Usuario.id == usuario_id, Usuario.ativo)
    )
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo.",
        )
    return usuario


@router.post("/mfa/email/solicitar", status_code=status.HTTP_202_ACCEPTED)
async def mfa_email_solicitar(
    dados: MfaDesafioRequest,
    session: AsyncSession = Depends(get_session),
):
    """Durante o login, envia um OTP ao e-mail do usuário do desafio."""
    usuario = await _usuario_do_desafio(session, dados.desafio)
    if not usuario.mfa_email_ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verificação por e-mail não está ativa para este usuário.",
        )

    envios = await registrar_envio_otp(str(usuario.id))
    if envios > MFA_OTP_MAX_ENVIOS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas solicitações de código. Aguarde alguns minutos.",
        )

    codigo = mfa_core.gerar_codigo_email()
    await salvar_otp_email(str(usuario.id), codigo)
    await enviar_codigo_mfa(usuario.email, usuario.nome, codigo)
    return {"message": "Código enviado para o e-mail cadastrado."}


@router.post("/mfa/verificar", response_model=LoginResponse)
async def mfa_verificar(
    dados: MfaVerificarRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Verifica o 2º fator (TOTP ou OTP de e-mail) e emite a sessão."""
    usuario = await _usuario_do_desafio(session, dados.desafio)

    ok = False
    if dados.metodo == "totp" and usuario.mfa_totp_ativo:
        ok = mfa_core.verificar_totp(usuario.mfa_totp_secret or "", dados.codigo)
    elif dados.metodo == "email" and usuario.mfa_email_ativo:
        ok = await verificar_otp_email(str(usuario.id), dados.codigo)

    if not ok:
        await log_event(
            session,
            acao="auth.mfa.failure",
            estudio_id=usuario.estudio_id,
            actor_usuario_id=usuario.id,
            actor_tipo=usuario.tipo.value,
            entidade="usuario",
            entidade_id=str(usuario.id),
            ip=get_client_ip(request),
            user_agent=get_user_agent(request),
            dados={"metodo": dados.metodo},
            commit=True,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de verificação inválido.",
        )

    await revogar_desafio_mfa(dados.desafio)
    await log_event(
        session,
        acao="auth.login.success",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        dados={"mfa": dados.metodo},
        commit=True,
    )
    await _emitir_sessao(response, usuario)
    return LoginResponse()
