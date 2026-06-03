from httpx import AsyncClient


class TestPublicoEndereco:
    async def test_portal_publico_contem_endereco_e_como_chegar(self, client: AsyncClient, autenticado: AsyncClient):
        # 1. Configura dados de endereço via autenticado
        dados_atualizacao = {
            "endereco_cep": "01311-200",
            "endereco_logradouro": "Avenida Paulista",
            "endereco_numero": "1000",
            "endereco_bairro": "Bela Vista",
            "endereco_cidade": "São Paulo",
            "endereco_uf": "SP",
            "google_negocio_url": None,  # Vai testar a URL gerada por endereço
        }
        r_patch = await autenticado.patch("/api/v1/estudio/", json=dados_atualizacao)
        assert r_patch.status_code == 200

        # 2. Acessa endpoint público
        r_public = await client.get("/api/v1/public/demo")
        assert r_public.status_code == 200, r_public.text
        body = r_public.json()

        assert "Avenida Paulista, 1000" in body["endereco_completo"]
        assert "Bela Vista" in body["endereco_completo"]
        assert "São Paulo" in body["endereco_completo"]
        assert "SP" in body["endereco_completo"]
        assert "01311-200" in body["endereco_completo"]
        assert "maps/search" in body["como_chegar_url"]
        assert "Avenida+Paulista%2C+1000" in body["como_chegar_url"]

    async def test_portal_publico_sem_endereco_retorna_nulo(self, client: AsyncClient, autenticado: AsyncClient):
        # 1. Limpa os campos de endereço
        dados_limpeza = {
            "endereco_cep": None,
            "endereco_logradouro": None,
            "endereco_numero": None,
            "endereco_complemento": None,
            "endereco_bairro": None,
            "endereco_cidade": None,
            "endereco_uf": None,
            "google_negocio_url": None,
            "cidade": None,
            "uf": None,
        }
        r_patch = await autenticado.patch("/api/v1/estudio/", json=dados_limpeza)
        assert r_patch.status_code == 200

        # 2. Acessa endpoint público
        r_public = await client.get("/api/v1/public/demo")
        assert r_public.status_code == 200
        body = r_public.json()

        assert body["endereco_completo"] is None
        assert body["como_chegar_url"] is None
