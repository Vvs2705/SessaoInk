from httpx import AsyncClient


class TestEstudioEndereco:
    async def test_obter_estudio_contem_novos_campos_endereco(self, autenticado: AsyncClient):
        r = await autenticado.get("/api/v1/estudio/")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "endereco_cep" in body
        assert "endereco_logradouro" in body
        assert "google_negocio_url" in body
        assert "endereco_completo" in body
        assert "como_chegar_url" in body

    async def test_atualizar_estudio_endereco_completo_e_google_url_valido(self, autenticado: AsyncClient):
        dados_atualizacao = {
            "endereco_cep": "01311-200",
            "endereco_logradouro": "Avenida Paulista",
            "endereco_numero": "1000",
            "endereco_complemento": "Bloco A, Sala 15",
            "endereco_bairro": "Bela Vista",
            "endereco_cidade": "São Paulo",
            "endereco_uf": "sp",
            "google_negocio_url": "https://maps.app.goo.gl/abcdefg12345",
        }

        r = await autenticado.patch("/api/v1/estudio/", json=dados_atualizacao)
        assert r.status_code == 200, r.text
        body = r.json()

        assert body["endereco_cep"] == "01311-200"
        assert body["endereco_logradouro"] == "Avenida Paulista"
        assert body["endereco_numero"] == "1000"
        assert body["endereco_complemento"] == "Bloco A, Sala 15"
        assert body["endereco_bairro"] == "Bela Vista"
        assert body["endereco_cidade"] == "São Paulo"
        assert body["endereco_uf"] == "SP"  # Deve vir em caixa alta
        assert body["google_negocio_url"] == "https://maps.app.goo.gl/abcdefg12345"
        assert "Avenida Paulista, 1000" in body["endereco_completo"]
        assert body["como_chegar_url"] == "https://maps.app.goo.gl/abcdefg12345"

    async def test_atualizar_estudio_com_google_url_invalido_retorna_422(self, autenticado: AsyncClient):
        dados_atualizacao = {
            "google_negocio_url": "https://exemplo.com/invalid-link",
        }

        r = await autenticado.patch("/api/v1/estudio/", json=dados_atualizacao)
        assert r.status_code == 422, r.text
        assert "Google Maps ou Google Negócios" in r.json()["detail"]
