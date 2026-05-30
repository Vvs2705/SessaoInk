"""Cliente Redis assíncrono — refresh tokens e rate limiting."""

from redis.asyncio import Redis

from app.core.config import settings

# Prefixo de chave para refresh tokens
REFRESH_PREFIX = "refresh:"

# Rate limiting — login por IP
LOGIN_FAIL_PREFIX = "login_fail:"
LOGIN_MAX_TENTATIVAS = 5
LOGIN_BLOQUEIO_SEGUNDOS = 15 * 60  # 15 minutos


def get_redis() -> Redis:
    """Retorna cliente Redis assíncrono."""
    return Redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )


async def salvar_refresh_token(token: str, usuario_id: str, ttl_dias: int) -> None:
    """Salva refresh token no Redis com TTL em dias."""
    async with get_redis() as r:
        await r.set(
            f"{REFRESH_PREFIX}{token}",
            usuario_id,
            ex=ttl_dias * 24 * 3600,
        )


async def obter_usuario_do_refresh(token: str) -> str | None:
    """Retorna o usuario_id vinculado ao refresh token, ou None se inválido/expirado."""
    async with get_redis() as r:
        return await r.get(f"{REFRESH_PREFIX}{token}")


async def revogar_refresh_token(token: str) -> None:
    """Remove refresh token do Redis (logout / rotação)."""
    async with get_redis() as r:
        await r.delete(f"{REFRESH_PREFIX}{token}")


# ---------------------------------------------------------------------------
# Rate limiting — login por IP (ADR-009)
# ---------------------------------------------------------------------------


async def verificar_bloqueio_login(ip: str) -> bool:
    """Retorna True se o IP está bloqueado por excesso de tentativas."""
    async with get_redis() as r:
        val = await r.get(f"{LOGIN_FAIL_PREFIX}{ip}")
        return int(val) >= LOGIN_MAX_TENTATIVAS if val else False


async def incrementar_tentativa_login(ip: str) -> int:
    """Incrementa contador de falhas; aplica TTL de bloqueio na primeira falha.
    Retorna o total de tentativas acumuladas."""
    async with get_redis() as r:
        chave = f"{LOGIN_FAIL_PREFIX}{ip}"
        total = await r.incr(chave)
        if total == 1:
            # Inicia o TTL apenas na primeira falha (não reinicia a cada tentativa)
            await r.expire(chave, LOGIN_BLOQUEIO_SEGUNDOS)
        return total


async def limpar_tentativas_login(ip: str) -> None:
    """Remove contador de falhas após login bem-sucedido."""
    async with get_redis() as r:
        await r.delete(f"{LOGIN_FAIL_PREFIX}{ip}")
