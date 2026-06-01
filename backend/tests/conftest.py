"""Fixtures globais de teste — SessãoInk.

Estratégia de event loop:
  - asyncio_default_fixture_loop_scope = session  → fixtures usam o loop da sessão
  - asyncio_default_test_loop_scope = session     → testes usam o loop da sessão
  - Cada teste recebe um AsyncClient **novo** (cookies isolados) mas compartilha
    o mesmo event loop, mantendo o pool de conexões do SQLAlchemy válido.

Redis:
  - O MockRedis em app.core.redis é um singleton com estado compartilhado.
  - Patches redis.asyncio.Redis antes de qualquer import da app para garantir
    que Redis.from_url(...) retorne sempre o mesmo singleton.
"""

import os

# CRITICAL: Deve ser definido ANTES de qualquer import da app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import redis.asyncio

# Importa o MockRedis singleton antes de qualquer coisa da app
from app.core.redis import MockRedis  # noqa: E402

# Substitui a classe Redis do módulo redis.asyncio pelo singleton MockRedis
# Isso garante que Redis.from_url() em qualquer parte do código retorne
# o mesmo objeto singleton com estado compartilhado
redis.asyncio.Redis = MockRedis  # type: ignore[assignment]

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import Base, engine
from app.core.security import hash_senha
from app.main import app
from app.models.usuario import Estudio, TipoUsuario, Usuario

ADMIN_EMAIL = "admin@sessaoink.dev"
ADMIN_SENHA = "admin123"


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Cria e popula o banco de dados SQLite de teste antes da execução de todos os testes."""
    # Reseta o estado do MockRedis para a sessão de testes
    MockRedis.reset()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    from app.core.database import async_session

    async with async_session() as session:
        estudio = Estudio(
            nome="Estúdio Demo",
            slug="demo",
            bio="Estúdio de tatuagem para demonstração local.",
            cidade="São Paulo",
            uf="SP",
            instagram="@estudioink",
        )
        session.add(estudio)
        await session.flush()

        admin = Usuario(
            estudio_id=estudio.id,
            nome="Admin SessãoInk",
            email=ADMIN_EMAIL,
            senha_hash=hash_senha(ADMIN_SENHA),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(admin)
        await session.commit()


async def _limpar_rate_limit_global() -> None:
    """Remove todas as chaves login_fail:* do MockRedis antes de fixtures de auth."""
    mock = MockRedis()  # singleton — sempre o mesmo objeto
    chaves = await mock.keys("login_fail:*")
    if chaves:
        await mock.delete(*chaves)


@pytest.fixture
async def client() -> AsyncClient:
    """Client HTTP fresco por teste (cookie jar limpo, loop compartilhado)."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
async def autenticado() -> AsyncClient:
    """Client HTTP fresco já logado como admin. Faz logout ao final.
    Limpa rate limiting antes do login para não ser bloqueado por outros testes."""
    await _limpar_rate_limit_global()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        r = await c.post(
            "/api/v1/auth/login",
            json={"email": ADMIN_EMAIL, "senha": ADMIN_SENHA},
        )
        assert r.status_code == 200, f"Falha no login de fixture: {r.text}"
        yield c
        await c.post("/api/v1/auth/logout")
