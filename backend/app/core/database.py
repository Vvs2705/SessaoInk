import asyncio

from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _connect_args(url: str) -> dict:
    """connect_args por driver.

    Postgres em produção fala com o pooler do Neon (PgBouncer em transaction
    mode), que NÃO suporta prepared statements nomeados entre transações: o
    cache de prepared statements do asyncpg dessincroniza o protocolo e gera
    erros como "message too large" / InterfaceError. Desligar o cache é
    obrigatório com PgBouncer. (Plano B, se reincidir: NullPool.)
    """
    if url.startswith("postgresql"):
        return {"statement_cache_size": 0}
    return {}  # SQLite (testes) não aceita esse argumento


# Create async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,      # reconecta automaticamente após idle (essencial para Neon)
    pool_size=5,             # Neon pooler já gerencia conexões — não exagerar
    max_overflow=10,
    pool_recycle=300,        # recicla conexões a cada 5 min (Neon desconecta idle)
    connect_args=_connect_args(settings.DATABASE_URL),
)

# Async session maker
async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Declarative Base for models
class Base(DeclarativeBase):
    pass

# Dependency to get session
async def get_session():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except (asyncio.CancelledError, InterfaceError, OperationalError):
            # Cliente desconectou no meio da query (CancelledError vindo dos
            # BaseHTTPMiddleware) ou o protocolo asyncpg dessincronizou: a
            # conexão pode estar suja. invalidate() descarta a conexão física
            # em vez de devolvê-la corrompida ao pool.
            try:
                await session.rollback()
            except BaseException:
                pass  # rollback pode falhar na conexão já corrompida
            await session.invalidate()
            raise
        except BaseException:
            # HTTPException e erros de aplicação não corrompem o protocolo:
            # rollback normal e a conexão volta saudável ao pool.
            # (BaseException, não Exception: cancelamento nunca pode pular
            # o rollback — era exatamente o bug que sujava o pool.)
            await session.rollback()
            raise
        finally:
            await session.close()
