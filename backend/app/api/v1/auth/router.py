"""Router de autenticação — login, logout, refresh, me."""

import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.api.v1.auth.schemas import (
    LoginRequest,
    SenhaAlterarRequest,
    TokenResponse,
    UsuarioResponse,
)
from app.core.config import settings
from app.core.database import get_session
from app.core.redis import (
    incrementar_tentativa_login,
    limpar_tentativas_login,
    obter_usuario_do_refresh,
    revogar_refresh_token,
    revogar_todas_sessoes_usuario,
    salvar_refresh_token,
    verificar_bloqueio_login,
)
from app.core.request_context import get_client_ip
from app.core.security import (
    criar_access_token,
    criar_refresh_token,
    hash_senha,
    verificar_senha,
)
from app.models.usuario import Usuario

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


@router.post("/login", response_model=TokenResponse)
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    # Login bem-sucedido — zerar contador de tentativas
    await limpar_tentativas_login(ip)

    # Gerar tokens
    access_token = criar_access_token(
        data={
            "sub": str(usuario.id),
            "estudio_id": str(usuario.estudio_id),
            "role": usuario.tipo.value,
        }
    )
    refresh_token = criar_refresh_token()

    # Salvar refresh token no Redis com TTL configurado
    await salvar_refresh_token(
        token=refresh_token,
        usuario_id=str(usuario.id),
        ttl_dias=settings.REFRESH_TOKEN_EXPIRE_DAYS,
    )

    # Definir cookies httpOnly
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

    return TokenResponse()


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
