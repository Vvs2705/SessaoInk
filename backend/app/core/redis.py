"""Cliente Redis assíncrono — refresh tokens e rate limiting."""

import logging
from typing import Any

from redis.asyncio import Redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Prefixo de chave para refresh tokens
REFRESH_PREFIX = "refresh:"

# Rate limiting — login por IP
LOGIN_FAIL_PREFIX = "login_fail:"
LOGIN_MAX_TENTATIVAS = 5
LOGIN_BLOQUEIO_SEGUNDOS = 15 * 60  # 15 minutos


class MockRedis:
    """Redis in-memory mock — singleton com estado compartilhado para testes."""

    _instance: "MockRedis | None" = None
    _shared_data: dict[str, str] = {}
    _shared_ttls: dict[str, int] = {}

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, *args, **kwargs):
        # Usa _shared_data para que toda instância veja o mesmo estado
        self._data = MockRedis._shared_data
        self._ttls = MockRedis._shared_ttls

    @classmethod
    def from_url(cls, *args, **kwargs):
        return cls()

    @classmethod
    def reset(cls) -> None:
        """Limpa todo o estado in-memory (útil entre test sessions)."""
        cls._shared_data.clear()
        cls._shared_ttls.clear()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def get(self, key: str) -> str | None:
        return self._data.get(key)

    async def set(self, key: str, value: Any, ex: int | None = None) -> None:
        self._data[key] = str(value)
        if ex:
            self._ttls[key] = ex

    async def delete(self, *keys: str) -> int:
        count = 0
        for k in keys:
            if k in self._data:
                del self._data[k]
                self._ttls.pop(k, None)
                count += 1
        return count

    async def incr(self, key: str) -> int:
        val = int(self._data.get(key, 0)) + 1
        self._data[key] = str(val)
        return val

    async def expire(self, key: str, seconds: int) -> bool:
        self._ttls[key] = seconds
        return True

    async def keys(self, pattern: str) -> list[str]:
        if pattern.endswith("*"):
            prefix = pattern[:-1]
            return [k for k in self._data.keys() if k.startswith(prefix)]
        return [k for k in self._data.keys() if k == pattern]

    async def ping(self) -> bool:
        return True


class RedisFallbackWrapper:
    """Redis com fallback gracioso para MockRedis — SOMENTE para dev/test.

    Em produção use get_redis() que retorna o cliente real sem fallback (fail-closed).
    """

    _use_mock: bool = False
    _mock_instance: MockRedis | None = None

    def __init__(self, real_client: Redis, mock_client: MockRedis):
        self.real_client = real_client
        self.mock_client = mock_client

    async def __aenter__(self):
        if RedisFallbackWrapper._use_mock:
            await self.mock_client.__aenter__()
            return self
        try:
            await self.real_client.__aenter__()
            await self.real_client.ping()
            return self
        except Exception as e:
            logger.warning(
                f"Falha ao conectar no Redis ({settings.REDIS_URL}), usando fallback in-memory (MockRedis): {e}"
            )
            RedisFallbackWrapper._use_mock = True
            await self.mock_client.__aenter__()
            return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if RedisFallbackWrapper._use_mock:
            await self.mock_client.__aexit__(exc_type, exc_val, exc_tb)
        else:
            try:
                await self.real_client.__aexit__(exc_type, exc_val, exc_tb)
            except Exception:
                pass

    async def get(self, key: str) -> str | None:
        if RedisFallbackWrapper._use_mock:
            return await self.mock_client.get(key)
        try:
            return await self.real_client.get(key)
        except Exception as e:
            logger.warning(f"Erro no Redis (get), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return await self.mock_client.get(key)

    async def set(self, key: str, value: Any, ex: int | None = None) -> None:
        if RedisFallbackWrapper._use_mock:
            await self.mock_client.set(key, value, ex)
            return
        try:
            await self.real_client.set(key, value, ex=ex)
        except Exception as e:
            logger.warning(f"Erro no Redis (set), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            await self.mock_client.set(key, value, ex)

    async def delete(self, *keys: str) -> int:
        if RedisFallbackWrapper._use_mock:
            return await self.mock_client.delete(*keys)
        try:
            return await self.real_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Erro no Redis (delete), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return await self.mock_client.delete(*keys)

    async def incr(self, key: str) -> int:
        if RedisFallbackWrapper._use_mock:
            return await self.mock_client.incr(key)
        try:
            return await self.real_client.incr(key)
        except Exception as e:
            logger.warning(f"Erro no Redis (incr), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return await self.mock_client.incr(key)

    async def expire(self, key: str, seconds: int) -> bool:
        if RedisFallbackWrapper._use_mock:
            return await self.mock_client.expire(key, seconds)
        try:
            return await self.real_client.expire(key, seconds)
        except Exception as e:
            logger.warning(f"Erro no Redis (expire), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return await self.mock_client.expire(key, seconds)

    async def keys(self, pattern: str) -> list[str]:
        if RedisFallbackWrapper._use_mock:
            return await self.mock_client.keys(pattern)
        try:
            return await self.real_client.keys(pattern)
        except Exception as e:
            logger.warning(f"Erro no Redis (keys), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return await self.mock_client.keys(pattern)

    async def ping(self) -> bool:
        if RedisFallbackWrapper._use_mock:
            return True
        try:
            return await self.real_client.ping()
        except Exception as e:
            logger.warning(f"Erro no Redis (ping), usando MockRedis fallback: {e}")
            RedisFallbackWrapper._use_mock = True
            return True


class ProductionRedis:
    """Wrapper Redis fail-closed — sem fallback em produção.

    Qualquer falha de conexão ou operação propaga a exceção imediatamente,
    garantindo que rate limiting e revogação de tokens nunca silenciem falhas.
    """

    def __init__(self, client: Redis):
        self._client = client

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, key: str) -> str | None:
        return await self._client.get(key)

    async def set(self, key: str, value: Any, ex: int | None = None) -> None:
        await self._client.set(key, value, ex=ex)

    async def delete(self, *keys: str) -> int:
        return await self._client.delete(*keys)

    async def incr(self, key: str) -> int:
        return await self._client.incr(key)

    async def expire(self, key: str, seconds: int) -> bool:
        return await self._client.expire(key, seconds)

    async def keys(self, pattern: str) -> list[str]:
        return await self._client.keys(pattern)

    async def ping(self) -> bool:
        return await self._client.ping()


_global_mock_redis = None


def get_redis() -> Any:
    """Retorna cliente Redis adequado ao ambiente.

    Produção (ENVIRONMENT=production):
        - Fail-closed: Redis indisponível → exceção propagada imediatamente.
        - Rate limiting e revogação de tokens nunca usam estado in-memory.

    Desenvolvimento / teste:
        - Fallback gracioso para MockRedis se Redis local não estiver disponível.
    """
    if settings.ENVIRONMENT == "production":
        client = Redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        return ProductionRedis(client)

    # Dev / test: fallback gracioso para não bloquear máquina sem Redis local
    global _global_mock_redis
    if _global_mock_redis is None:
        _global_mock_redis = MockRedis()
    real_client = Redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    return RedisFallbackWrapper(real_client, _global_mock_redis)


async def salvar_refresh_token(token: str, usuario_id: str, ttl_dias: int) -> None:
    """Salva refresh token no Redis sob o HASH SHA-256 (nunca o valor puro)."""
    from app.core.security import hash_refresh_token

    async with get_redis() as r:
        await r.set(
            f"{REFRESH_PREFIX}{hash_refresh_token(token)}",
            usuario_id,
            ex=ttl_dias * 24 * 3600,
        )


async def obter_usuario_do_refresh(token: str) -> str | None:
    """Retorna o usuario_id vinculado ao refresh token, ou None se inválido/expirado."""
    from app.core.security import hash_refresh_token

    async with get_redis() as r:
        return await r.get(f"{REFRESH_PREFIX}{hash_refresh_token(token)}")


async def revogar_refresh_token(token: str) -> None:
    """Remove refresh token do Redis (logout / rotação)."""
    from app.core.security import hash_refresh_token

    async with get_redis() as r:
        await r.delete(f"{REFRESH_PREFIX}{hash_refresh_token(token)}")


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


# ---------------------------------------------------------------------------
# Rate limiting — orçamento público por IP
# ---------------------------------------------------------------------------

ORCAMENTO_LIMIT_PREFIX = "orcamento_limit:"
ORCAMENTO_MAX_REQUISICOES = 5
ORCAMENTO_BLOQUEIO_SEGUNDOS = 10 * 60  # 10 minutos


async def verificar_limite_orcamento(ip: str) -> bool:
    """Retorna True se o IP excedeu o limite de solicitações de orçamento."""
    async with get_redis() as r:
        val = await r.get(f"{ORCAMENTO_LIMIT_PREFIX}{ip}")
        return int(val) >= ORCAMENTO_MAX_REQUISICOES if val else False


async def registrar_solicitacao_orcamento(ip: str) -> int:
    """Incrementa o contador de solicitações de orçamento do IP.
    Retorna o total acumulado."""
    async with get_redis() as r:
        chave = f"{ORCAMENTO_LIMIT_PREFIX}{ip}"
        total = await r.incr(chave)
        if total == 1:
            await r.expire(chave, ORCAMENTO_BLOQUEIO_SEGUNDOS)
        return total


# ---------------------------------------------------------------------------
# Gestão de sessões por usuário
# ---------------------------------------------------------------------------


async def revogar_todas_sessoes_usuario(usuario_id: str) -> int:
    """Revoga todos os refresh tokens do usuário — chamado após troca de senha.

    Varre chaves `refresh:*` e remove as vinculadas ao usuario_id.
    Aceitável para a escala atual; em escala maior use um índice reverso.
    Retorna o número de sessões revogadas.
    """
    async with get_redis() as r:
        todas_chaves = await r.keys(f"{REFRESH_PREFIX}*")
        revogadas = 0
        for chave in todas_chaves:
            valor = await r.get(chave)
            if valor == usuario_id:
                await r.delete(chave)
                revogadas += 1
        if revogadas:
            logger.info(
                f"Sessões revogadas após troca de senha: {revogadas} (usuario_id={usuario_id})"
            )
        return revogadas

