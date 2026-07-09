"""Testes do hotfix "postgres message too large" (dessincronização asyncpg).

Cobre as duas vias do bug e as defesas de borda:
  - H2: statement cache do asyncpg desligado com Postgres (Neon/PgBouncer);
  - H1: get_session invalida a conexão em CancelledError/erro de protocolo
    (nunca devolve conexão suja ao pool);
  - handler global 503 para erro transitório de banco;
  - validar_slug: slug de scanner (".env") → 404 sem tocar o banco;
  - rate limit generoso nos GETs públicos → 429.
"""

import asyncio

import pytest
from fastapi import HTTPException
from httpx import AsyncClient
from sqlalchemy.exc import InterfaceError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.publico.router import PUBLICO_GET_MAX_POR_MINUTO, PUBLICO_GET_PREFIX
from app.core.database import _connect_args, get_session
from app.core.redis import MockRedis


@pytest.fixture(autouse=True)
async def limpar_rate_limit_publico():
    """Zera contadores de rate limit antes/após cada teste — MockRedis não expira TTL."""
    mock = MockRedis()

    async def _limpar():
        for prefixo in (PUBLICO_GET_PREFIX, "orcamento_limit:"):
            chaves = await mock.keys(f"{prefixo}*")
            if chaves:
                await mock.delete(*chaves)

    await _limpar()
    yield
    await _limpar()


# ---------------------------------------------------------------------------
# H2 — connect_args por driver
# ---------------------------------------------------------------------------


class TestConnectArgs:
    def test_postgres_desliga_statement_cache(self):
        """Com Postgres (Neon pooler/PgBouncer), o cache DEVE estar desligado."""
        args = _connect_args("postgresql+asyncpg://user:pass@host/db")
        assert args == {"statement_cache_size": 0}

    def test_sqlite_sem_connect_args(self):
        """SQLite (testes) não aceita statement_cache_size."""
        assert _connect_args("sqlite+aiosqlite:///./test.db") == {}


# ---------------------------------------------------------------------------
# H1 — get_session nunca devolve conexão suja ao pool
# ---------------------------------------------------------------------------


class TestGetSessionInvalidacao:
    async def _abrir_sessao(self):
        gen = get_session()
        session = await gen.__anext__()
        return gen, session

    async def test_cancelamento_invalida_conexao(self, monkeypatch):
        """CancelledError (cliente desconectou) → rollback + invalidate + re-raise."""
        invalidadas: list[int] = []
        original = AsyncSession.invalidate

        async def spy(self, *args, **kwargs):
            invalidadas.append(1)
            return await original(self, *args, **kwargs)

        monkeypatch.setattr(AsyncSession, "invalidate", spy)

        gen, _session = await self._abrir_sessao()
        with pytest.raises(asyncio.CancelledError):
            await gen.athrow(asyncio.CancelledError())
        assert invalidadas, "Conexão deveria ter sido invalidada após cancelamento"

    async def test_erro_de_protocolo_invalida_conexao(self, monkeypatch):
        """InterfaceError (protocolo dessincronizado) → invalidate + re-raise."""
        invalidadas: list[int] = []
        original = AsyncSession.invalidate

        async def spy(self, *args, **kwargs):
            invalidadas.append(1)
            return await original(self, *args, **kwargs)

        monkeypatch.setattr(AsyncSession, "invalidate", spy)

        gen, _session = await self._abrir_sessao()
        with pytest.raises(InterfaceError):
            await gen.athrow(InterfaceError("SELECT 1", None, Exception("message too large")))
        assert invalidadas

    async def test_http_exception_faz_rollback_sem_invalidar(self, monkeypatch):
        """HTTPException não corrompe protocolo: rollback normal, SEM invalidate."""
        invalidadas: list[int] = []
        rollbacks: list[int] = []
        orig_invalidate = AsyncSession.invalidate
        orig_rollback = AsyncSession.rollback

        async def spy_invalidate(self, *args, **kwargs):
            invalidadas.append(1)
            return await orig_invalidate(self, *args, **kwargs)

        async def spy_rollback(self, *args, **kwargs):
            rollbacks.append(1)
            return await orig_rollback(self, *args, **kwargs)

        monkeypatch.setattr(AsyncSession, "invalidate", spy_invalidate)
        monkeypatch.setattr(AsyncSession, "rollback", spy_rollback)

        gen, _session = await self._abrir_sessao()
        with pytest.raises(HTTPException):
            await gen.athrow(HTTPException(404, "não achei"))
        assert rollbacks, "HTTPException deveria fazer rollback"
        assert not invalidadas, "HTTPException NÃO deveria invalidar a conexão"


# ---------------------------------------------------------------------------
# Handler global — erro transitório de banco vira 503, não 500
# ---------------------------------------------------------------------------


class TestHandler503:
    async def test_interface_error_vira_503_com_retry_after(
        self, client: AsyncClient, monkeypatch
    ):
        async def explode(self, *args, **kwargs):
            raise InterfaceError("SELECT 1", None, Exception("message too large"))

        monkeypatch.setattr(AsyncSession, "execute", explode)

        r = await client.get("/api/v1/public/estudios")
        assert r.status_code == 503
        assert r.headers.get("Retry-After") == "2"
        assert r.json() == {
            "detail": "Serviço temporariamente indisponível, tente novamente."
        }


# ---------------------------------------------------------------------------
# validar_slug — scanner não gasta query
# ---------------------------------------------------------------------------


class TestValidarSlug:
    @pytest.fixture
    def spy_banco(self, monkeypatch):
        """Registra qualquer execute/scalar de sessão — para provar 'sem query'."""
        chamadas: list[str] = []
        orig_execute = AsyncSession.execute
        orig_scalar = AsyncSession.scalar

        async def spy_execute(self, *args, **kwargs):
            chamadas.append("execute")
            return await orig_execute(self, *args, **kwargs)

        async def spy_scalar(self, *args, **kwargs):
            chamadas.append("scalar")
            return await orig_scalar(self, *args, **kwargs)

        monkeypatch.setattr(AsyncSession, "execute", spy_execute)
        monkeypatch.setattr(AsyncSession, "scalar", spy_scalar)
        return chamadas

    async def test_slug_env_404_sem_query(self, client: AsyncClient, spy_banco):
        """Slug de scanner ('.env') → 404 imediato sem nenhuma query."""
        r = await client.get("/api/v1/public/.env")
        assert r.status_code == 404
        assert spy_banco == [], "Slug inválido não pode gerar query no banco"

    async def test_slug_invalido_em_subrota_404_sem_query(
        self, client: AsyncClient, spy_banco
    ):
        r = await client.get("/api/v1/public/.git/portfolio")
        assert r.status_code == 404
        assert spy_banco == []

        r = await client.get("/api/v1/public/UPPER_CASE/disponibilidade")
        assert r.status_code == 404
        assert spy_banco == []

    async def test_slug_valido_inexistente_404(self, client: AsyncClient, spy_banco):
        """Slug bem-formado mas inexistente → 404 via consulta normal."""
        r = await client.get("/api/v1/public/estudio-que-nao-existe-xyz")
        assert r.status_code == 404
        assert spy_banco, "Slug válido deve consultar o banco normalmente"

    async def test_slug_valido_existente_200(self, client: AsyncClient):
        """Contrato preservado: portal do estúdio 'demo' segue respondendo."""
        r = await client.get("/api/v1/public/demo")
        assert r.status_code == 200
        assert r.json()["slug"] == "demo"


# ---------------------------------------------------------------------------
# Rate limit dos GETs públicos
# ---------------------------------------------------------------------------


class TestRateLimitGetPublico:
    async def test_estouro_retorna_429(self, client: AsyncClient):
        mock = MockRedis()

        # 1ª requisição cria o contador do IP
        r = await client.get("/api/v1/public/planos")
        assert r.status_code == 200
        chaves = await mock.keys(f"{PUBLICO_GET_PREFIX}*")
        assert len(chaves) == 1

        # Simula IP no limite — a próxima requisição estoura
        await mock.set(chaves[0], str(PUBLICO_GET_MAX_POR_MINUTO))
        r = await client.get("/api/v1/public/planos")
        assert r.status_code == 429

    async def test_post_orcamento_nao_conta_no_limite_de_get(self, client: AsyncClient):
        """POSTs têm limites próprios — o bucket publico_get é só de GETs."""
        mock = MockRedis()
        r = await client.post(
            "/api/v1/public/demo/orcamento",
            data={
                "nome": "Teste Bucket",
                "whatsapp": "11999999999",
                "aceite_privacidade": "true",
                "aceite_termos": "true",
            },
        )
        assert r.status_code == 201
        assert await mock.keys(f"{PUBLICO_GET_PREFIX}*") == []
