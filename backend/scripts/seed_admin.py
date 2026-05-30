"""Script para criar estúdio e usuário admin de teste."""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.core.config import settings
from app.core.security import hash_senha
from app.models.usuario import Estudio, Usuario, TipoUsuario


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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
            email="admin@sessaoink.local",
            senha_hash=hash_senha("admin123"),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(admin)
        await session.commit()

        print(f"✅ Estúdio criado: {estudio.nome} (slug: {estudio.slug})")
        print(f"✅ Admin criado: {admin.email} / senha: admin123")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
