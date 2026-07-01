"""Testes — direitos do titular (LGPD art. 18): exportação e exclusão."""

from httpx import AsyncClient


class TestExportacao:
    async def test_exportar_retorna_dados_do_titular(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/lgpd/exportar")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "titular" in body
        assert body["titular"]["email"]
        assert body["titular"]["papel"] in ("ADMIN", "ARTISTA", "RECEPCIONISTA")
        assert "verificacao_duas_etapas" in body["titular"]
        assert "estudio" in body
        assert "gerado_em" in body

    async def test_exportar_nao_vaza_segredos(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/lgpd/exportar")
        texto = r.text.lower()
        assert "senha_hash" not in texto
        assert "mfa_totp_secret" not in texto
        assert "senha" not in texto

    async def test_exportar_exige_autenticacao(self, client: AsyncClient):
        r = await client.get("/api/v1/lgpd/exportar")
        assert r.status_code in (401, 403)


class TestSolicitarExclusao:
    async def test_solicitar_exclusao_registra(self, autenticado: AsyncClient):
        r = await autenticado.post("/api/v1/lgpd/solicitar-exclusao")
        assert r.status_code == 202, r.text
        assert "message" in r.json()

    async def test_solicitar_exclusao_exige_autenticacao(self, client: AsyncClient):
        r = await client.post("/api/v1/lgpd/solicitar-exclusao")
        assert r.status_code in (401, 403)
