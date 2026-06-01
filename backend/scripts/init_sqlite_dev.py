"""Script para inicializar e popular banco de dados SQLite de desenvolvimento local."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.core.security import hash_senha
from app.models.usuario import Estudio, TipoUsuario, Usuario


async def init():
    db_url = "sqlite+aiosqlite:///./dev.db"
    print(f"Inicializando banco de dados SQLite: {db_url}")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with session_factory() as session:
        # Criar estúdio
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

        # Criar admin
        admin = Usuario(
            estudio_id=estudio.id,
            nome="Admin SessãoInk",
            email="admin@sessaoink.dev",
            senha_hash=hash_senha("admin123"),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(admin)
        await session.commit()

        print("Banco SQLite dev.db criado e semeado com sucesso!")
        print(f"Estudio criado: {estudio.nome} (slug: {estudio.slug})")
        print(f"Admin criado: {admin.email} / senha: admin123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init())
