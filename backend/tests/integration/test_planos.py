"""Catálogo público de planos (precificação)."""

from httpx import AsyncClient


class TestPlanos:
    async def test_lista_publica_de_planos(self, client: AsyncClient):
        r = await client.get("/api/v1/public/planos")
        assert r.status_code == 200
        data = r.json()
        planos = data["planos"]
        assert len(planos) == 3
        slugs = {p["slug"] for p in planos}
        assert slugs == {"essencial", "profissional", "avancado"}
        assert data["trial_dias"] == 14

    async def test_profissional_eh_destaque_com_promo(self, client: AsyncClient):
        r = await client.get("/api/v1/public/planos")
        prof = next(p for p in r.json()["planos"] if p["slug"] == "profissional")
        assert prof["destaque"] is True
        assert prof["preco_mensal"] == 135.0
        assert prof["promocao"]["preco_promocional"] == 100.0
        assert prof["promocao"]["meses"] == 6

    async def test_precos_dos_tres_planos(self, client: AsyncClient):
        r = await client.get("/api/v1/public/planos")
        precos = {p["slug"]: p["preco_mensal"] for p in r.json()["planos"]}
        assert precos == {"essencial": 50.0, "profissional": 135.0, "avancado": 200.0}

    async def test_rota_planos_nao_quebra_slug_de_estudio(self, client: AsyncClient):
        # /public/planos não pode ser tratado como slug de estúdio
        r = await client.get("/api/v1/public/slug-inexistente-xyz")
        assert r.status_code == 404  # estúdio não encontrado (rota slug ainda funciona)
