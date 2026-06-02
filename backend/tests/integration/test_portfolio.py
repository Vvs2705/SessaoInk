"""Testes de integração — Portfólio (upload seguro, acesso autenticado)."""

import io

from httpx import AsyncClient
from PIL import Image

# ── Helpers de imagem de teste ────────────────────────────────────────────────
# O pipeline de upload seguro (P0-04) decodifica a imagem com Pillow, então os
# fixtures precisam ser imagens REAIS (decodificáveis), não apenas headers válidos.

def jpeg_minimo() -> bytes:
    """JPEG real mínimo (decodificável pelo Pillow)."""
    img = Image.new("RGB", (4, 4), (200, 100, 50))
    out = io.BytesIO()
    img.save(out, format="JPEG")
    return out.getvalue()


def png_minimo() -> bytes:
    """PNG real mínimo (decodificável pelo Pillow)."""
    img = Image.new("RGB", (4, 4), (255, 255, 255))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def arquivo_invalido() -> bytes:
    """Arquivo com magic bytes que não são de imagem."""
    return b"PK\x03\x04NOTANIMAGE_THIS_IS_A_ZIP_FILE_DISGUISED"


# ── Testes ────────────────────────────────────────────────────────────────────

class TestUpload:
    async def test_upload_jpeg_valido_retorna_201(self, autenticado: AsyncClient):
        """Upload de JPEG válido cria registro no banco (201)."""
        r = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["visibilidade"] == "PRIVADO"   # ADR-005: privado por padrão
        assert data["autorizado_publicacao"] is False

        # Cleanup — soft delete
        await autenticado.delete(f"/api/v1/portfolio/{data['id']}")

    async def test_upload_png_valido_retorna_201(self, autenticado: AsyncClient):
        """Upload de PNG válido também é aceito."""
        r = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.png", io.BytesIO(png_minimo()), "image/png")},
        )
        assert r.status_code == 201, r.text
        await autenticado.delete(f"/api/v1/portfolio/{r.json()['id']}")

    async def test_upload_magic_bytes_invalidos_retorna_415(self, autenticado: AsyncClient):
        """Arquivo com magic bytes errados (mesmo com MIME correto) retorna 415."""
        r = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("malicio.jpg", io.BytesIO(arquivo_invalido()), "image/jpeg")},
        )
        assert r.status_code == 415, r.text

    async def test_upload_mime_invalido_retorna_415(self, autenticado: AsyncClient):
        """Upload com MIME não permitido (text/plain) retorna 415."""
        r = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("script.txt", io.BytesIO(b"conteudo qualquer"), "text/plain")},
        )
        assert r.status_code == 415, r.text

    async def test_upload_sem_auth_retorna_401(self, client: AsyncClient):
        """Upload sem autenticação retorna 401."""
        r = await client.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        assert r.status_code == 401


class TestListagem:
    async def test_listar_retorna_apenas_proprio_estudio(self, autenticado: AsyncClient):
        """GET /portfolio/ retorna lista (pode ser vazia) do próprio estúdio."""
        r = await autenticado.get("/api/v1/portfolio/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    async def test_listar_sem_auth_retorna_401(self, client: AsyncClient):
        """GET /portfolio/ sem auth retorna 401."""
        r = await client.get("/api/v1/portfolio/")
        assert r.status_code == 401


class TestServirImagem:
    async def test_imagem_sem_auth_retorna_401(self, client: AsyncClient):
        """GET /{id}/imagem sem autenticação retorna 401 — nunca expõe filesystem."""
        # UUID inexistente — não importa, o 401 vem antes do 404
        r = await client.get("/api/v1/portfolio/00000000-0000-0000-0000-000000000001/imagem")
        assert r.status_code == 401

    async def test_imagem_inexistente_autenticado_retorna_404(self, autenticado: AsyncClient):
        """GET /{id}/imagem com UUID inválido retorna 404 (não expõe path)."""
        r = await autenticado.get(
            "/api/v1/portfolio/00000000-0000-0000-0000-000000000001/imagem"
        )
        assert r.status_code == 404


class TestVisibilidade:
    async def test_privado_por_padrao(self, autenticado: AsyncClient):
        """Foto recém-enviada nasce como PRIVADO (ADR-005)."""
        r = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        assert r.status_code == 201
        assert r.json()["visibilidade"] == "PRIVADO"
        await autenticado.delete(f"/api/v1/portfolio/{r.json()['id']}")

    async def test_publicar_sem_autorizacao_retorna_400(self, autenticado: AsyncClient):
        """Publicar sem autorizado=true retorna 400 (ADR-005)."""
        upload = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        foto_id = upload.json()["id"]

        r = await autenticado.patch(
            f"/api/v1/portfolio/{foto_id}/visibilidade?visibilidade=PUBLICO&autorizado=false"
        )
        assert r.status_code == 400

        await autenticado.delete(f"/api/v1/portfolio/{foto_id}")

    async def test_publicar_com_autorizacao_retorna_200(self, autenticado: AsyncClient):
        """Publicar com autorizado=true altera visibilidade para PUBLICO."""
        upload = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        foto_id = upload.json()["id"]

        r = await autenticado.patch(
            f"/api/v1/portfolio/{foto_id}/visibilidade?visibilidade=PUBLICO&autorizado=true"
        )
        assert r.status_code == 200
        assert r.json()["visibilidade"] == "PUBLICO"
        assert r.json()["autorizado_publicacao"] is True

        await autenticado.delete(f"/api/v1/portfolio/{foto_id}")


class TestArquivamento:
    async def test_arquivar_some_da_listagem_e_aparece_em_arquivados(
        self, autenticado: AsyncClient
    ):
        """Arquivar (DELETE) tira a foto da listagem ativa e a põe em /arquivados."""
        up = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        foto_id = up.json()["id"]

        assert (await autenticado.delete(f"/api/v1/portfolio/{foto_id}")).status_code == 204

        ativos = (await autenticado.get("/api/v1/portfolio/")).json()
        assert foto_id not in [x["id"] for x in ativos]

        arquivados = (await autenticado.get("/api/v1/portfolio/arquivados")).json()
        assert foto_id in [x["id"] for x in arquivados]

        # cleanup
        await autenticado.delete(f"/api/v1/portfolio/{foto_id}/permanente")

    async def test_restaurar_volta_para_ativos_como_privado(
        self, autenticado: AsyncClient
    ):
        """Restaurar reativa a foto (privada) e some de /arquivados."""
        up = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        foto_id = up.json()["id"]
        await autenticado.delete(f"/api/v1/portfolio/{foto_id}")

        r = await autenticado.patch(f"/api/v1/portfolio/{foto_id}/restaurar")
        assert r.status_code == 200, r.text
        assert r.json()["ativo"] is True
        assert r.json()["visibilidade"] == "PRIVADO"

        ativos = (await autenticado.get("/api/v1/portfolio/")).json()
        assert foto_id in [x["id"] for x in ativos]

        await autenticado.delete(f"/api/v1/portfolio/{foto_id}/permanente")

    async def test_exclusao_permanente_remove_de_vez(self, autenticado: AsyncClient):
        """Exclusão permanente (ADMIN) remove o registro de forma irreversível."""
        up = await autenticado.post(
            "/api/v1/portfolio/upload",
            files={"arquivo": ("foto.jpg", io.BytesIO(jpeg_minimo()), "image/jpeg")},
        )
        foto_id = up.json()["id"]

        r = await autenticado.delete(f"/api/v1/portfolio/{foto_id}/permanente")
        assert r.status_code == 204, r.text

        # Não aparece nem em ativos nem em arquivados; restaurar dá 404.
        arquivados = (await autenticado.get("/api/v1/portfolio/arquivados")).json()
        assert foto_id not in [x["id"] for x in arquivados]
        assert (
            await autenticado.patch(f"/api/v1/portfolio/{foto_id}/restaurar")
        ).status_code == 404

    async def test_arquivados_sem_auth_retorna_401(self, client: AsyncClient):
        r = await client.get("/api/v1/portfolio/arquivados")
        assert r.status_code == 401
