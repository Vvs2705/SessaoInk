"""Endpoint público de slugs para o sitemap (GET /public/estudios)."""

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session
from app.models.portfolio import Portfolio, VisibilidadePortfolio
from app.models.usuario import Estudio


class TestEstudiosPublicos:
    async def test_lista_responde_200(self, client: AsyncClient):
        r = await client.get("/api/v1/public/estudios")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_inclui_estudio_com_portfolio_publico(self, client: AsyncClient):
        async with async_session() as s:
            est = await s.scalar(select(Estudio).where(Estudio.slug == "demo"))
            assert est is not None
            s.add(
                Portfolio(
                    estudio_id=est.id,
                    imagem_path=f"demo/{uuid.uuid4().hex}.jpg",
                    visibilidade=VisibilidadePortfolio.PUBLICO,
                )
            )
            await s.commit()

        r = await client.get("/api/v1/public/estudios")
        assert r.status_code == 200
        slugs = [e["slug"] for e in r.json()]
        assert "demo" in slugs
