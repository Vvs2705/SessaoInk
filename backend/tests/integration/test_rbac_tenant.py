
import uuid
from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.database import async_session
from app.core.security import hash_senha
from app.models.atendimento import Atendimento, StatusOperacional, TipoAtendimento
from app.models.cliente import Cliente
from app.models.documento import Documento, TipoDocumento
from app.models.financeiro import Lancamento, TipoLancamento
from app.models.portfolio import FlashArt, Portfolio
from app.models.usuario import Estudio, TipoUsuario, Usuario

INVASOR_EMAIL = "admin@invasor.dev"
ARTISTA_EMAIL = "artista@sessaoink.dev"
RECEPCIONISTA_EMAIL = "recep@sessaoink.dev"
ADMIN_EMAIL = "admin@sessaoink.dev"  # admin do estúdio demo (criado no conftest)
SENHA = "admin123"

@pytest.fixture(scope="session", autouse=True)
async def seed_rbac_tenant_data():
    """Cria estúdio invasor, usuários com diferentes roles, clientes, atendimentos, etc. no BD de teste."""
    async with async_session() as session:
        # Obter o estúdio demo existente
        result_demo = await session.execute(select(Estudio).where(Estudio.slug == "demo"))
        estudio_demo = result_demo.scalar_one()

        # Idempotência: este fixture é session-scoped, mas pode ser reexecutado
        # quando o event loop de sessão é recriado (interação pytest-asyncio com
        # outros módulos). Se o seed já rodou, não recriar — evita colisão de
        # UNIQUE em estudios.slug.
        ja_semeado = await session.scalar(
            select(Estudio).where(Estudio.slug == "invasor")
        )
        if ja_semeado is not None:
            return

        # Criar estúdio invasor
        estudio_invasor = Estudio(
            nome="Estúdio Invasor",
            slug="invasor",
            bio="Estúdio hacker.",
            cidade="Curitiba",
            uf="PR",
        )
        session.add(estudio_invasor)
        await session.flush()

        # Criar admin invasor
        admin_invasor = Usuario(
            estudio_id=estudio_invasor.id,
            nome="Admin Invasor",
            email=INVASOR_EMAIL,
            senha_hash=hash_senha(SENHA),
            tipo=TipoUsuario.ADMIN,
        )
        session.add(admin_invasor)

        # Criar artista no estúdio demo
        artista_demo = Usuario(
            estudio_id=estudio_demo.id,
            nome="Artista Demo",
            email=ARTISTA_EMAIL,
            senha_hash=hash_senha(SENHA),
            tipo=TipoUsuario.ARTISTA,
        )
        session.add(artista_demo)

        # Criar recepcionista no estúdio demo
        recep_demo = Usuario(
            estudio_id=estudio_demo.id,
            nome="Recepcionista Demo",
            email=RECEPCIONISTA_EMAIL,
            senha_hash=hash_senha(SENHA),
            tipo=TipoUsuario.RECEPCIONISTA,
        )
        session.add(recep_demo)

        # Criar cliente no estúdio demo
        cliente_demo = Cliente(
            estudio_id=estudio_demo.id,
            nome="Cliente Demo",
            email="cliente@demo.com",
            telefone="11999999999",
        )
        session.add(cliente_demo)
        await session.flush()

        # Criar atendimento no estúdio demo
        atend_demo = Atendimento(
            estudio_id=estudio_demo.id,
            cliente_id=cliente_demo.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Tatuagem do cliente demo",
        )
        session.add(atend_demo)
        await session.flush()

        # Criar documento no estúdio demo
        doc_demo = Documento(
            estudio_id=estudio_demo.id,
            cliente_id=cliente_demo.id,
            tipo=TipoDocumento.CONSENTIMENTO,
            titulo="Termo Demo",
            versao="1.0",
        )
        session.add(doc_demo)

        # Criar lançamento financeiro no estúdio demo
        lanc_demo = Lancamento(
            estudio_id=estudio_demo.id,
            tipo=TipoLancamento.ENTRADA,
            descricao="Lançamento Demo",
            valor=100.0,
        )
        session.add(lanc_demo)

        await session.commit()


async def _get_auth_client(client: AsyncClient, email: str) -> AsyncClient:
    """Helper para autenticar o cliente HTTP com um email de teste."""
    client.cookies.clear()
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "senha": SENHA},
    )
    assert r.status_code == 200, f"Falha login: {r.text}"
    return client


class TestTenantIsolationCrossOperations:
    @pytest.mark.asyncio
    async def test_invasor_nao_deve_ver_clientes_do_demo(self, client: AsyncClient):
        # Autentica como invasor
        authed = await _get_auth_client(client, INVASOR_EMAIL)

        # 1. Tenta listar clientes (não deve vir o cliente demo)
        r_list = await authed.get("/api/v1/clientes/")
        assert r_list.status_code == 200
        for c in r_list.json():
            assert c["nome"] != "Cliente Demo"

        # Obter o id do cliente demo do BD
        async with async_session() as session:
            client_id = await session.scalar(select(Cliente.id).where(Cliente.nome == "Cliente Demo"))

        # 2. Tenta obter o cliente demo diretamente
        r_get = await authed.get(f"/api/v1/clientes/{client_id}")
        assert r_get.status_code == 404

        # 3. Tenta deletar o cliente demo
        r_del = await authed.delete(f"/api/v1/clientes/{client_id}")
        assert r_del.status_code == 404

    @pytest.mark.asyncio
    async def test_invasor_nao_deve_ver_atendimentos_do_demo(self, client: AsyncClient):
        authed = await _get_auth_client(client, INVASOR_EMAIL)

        async with async_session() as session:
            atend_id = await session.scalar(select(Atendimento.id).where(Atendimento.descricao == "Tatuagem do cliente demo"))

        r_get = await authed.get(f"/api/v1/atendimentos/{atend_id}")
        assert r_get.status_code == 404

        r_del = await authed.delete(f"/api/v1/atendimentos/{atend_id}")
        assert r_del.status_code == 404

    @pytest.mark.asyncio
    async def test_invasor_nao_deve_ver_documentos_do_demo(self, client: AsyncClient):
        authed = await _get_auth_client(client, INVASOR_EMAIL)

        async with async_session() as session:
            doc_id = await session.scalar(select(Documento.id).where(Documento.titulo == "Termo Demo"))

        r_get = await authed.get(f"/api/v1/documentos/{doc_id}")
        assert r_get.status_code == 404

        r_del = await authed.delete(f"/api/v1/documentos/{doc_id}")
        assert r_del.status_code == 404

    @pytest.mark.asyncio
    async def test_invasor_nao_deve_ver_ou_deletar_lancamentos_do_demo(self, client: AsyncClient):
        authed = await _get_auth_client(client, INVASOR_EMAIL)

        async with async_session() as session:
            lanc_id = await session.scalar(select(Lancamento.id).where(Lancamento.descricao == "Lançamento Demo"))

        r_get = await authed.patch(f"/api/v1/financeiro/{lanc_id}", json={"valor": 200.0})
        assert r_get.status_code == 404

        r_del = await authed.delete(f"/api/v1/financeiro/{lanc_id}")
        assert r_del.status_code == 404


class TestRBACPermissions:
    @pytest.mark.asyncio
    async def test_artista_e_recepcionista_bloqueados_em_convites(self, client: AsyncClient):
        # 1. Testando Artista
        authed_art = await _get_auth_client(client, ARTISTA_EMAIL)
        r_art_post = await authed_art.post("/api/v1/convites/", json={"email": "novo@convite.com", "role": "ARTISTA"})
        assert r_art_post.status_code == 403

        r_art_get = await authed_art.get("/api/v1/convites/")
        assert r_art_get.status_code == 403

        # 2. Testando Recepcionista
        authed_recep = await _get_auth_client(client, RECEPCIONISTA_EMAIL)
        r_recep_post = await authed_recep.post("/api/v1/convites/", json={"email": "novo2@convite.com", "role": "ARTISTA"})
        assert r_recep_post.status_code == 403

        r_recep_get = await authed_recep.get("/api/v1/convites/")
        assert r_recep_get.status_code == 403

    @pytest.mark.asyncio
    async def test_artista_e_recepcionista_bloqueados_em_deletar_lancamento(self, client: AsyncClient):
        async with async_session() as session:
            lanc_id = await session.scalar(select(Lancamento.id).where(Lancamento.descricao == "Lançamento Demo"))

        # Artista tentando deletar -> 403
        authed_art = await _get_auth_client(client, ARTISTA_EMAIL)
        r_art = await authed_art.delete(f"/api/v1/financeiro/{lanc_id}")
        assert r_art.status_code == 403

        # Recepcionista tentando deletar -> 403
        authed_recep = await _get_auth_client(client, RECEPCIONISTA_EMAIL)
        r_recep = await authed_recep.delete(f"/api/v1/financeiro/{lanc_id}")
        assert r_recep.status_code == 403


class TestRBACOperacoesAdmin:
    """P0-03 — operações restritas a ADMIN por papel."""

    @pytest.mark.asyncio
    async def test_recepcionista_nao_altera_config_estudio(self, client: AsyncClient):
        authed = await _get_auth_client(client, RECEPCIONISTA_EMAIL)
        r = await authed.patch("/api/v1/estudio/", json={"bio": "hack"})
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_artista_nao_altera_config_estudio(self, client: AsyncClient):
        authed = await _get_auth_client(client, ARTISTA_EMAIL)
        r = await authed.patch("/api/v1/estudio/", json={"bio": "hack"})
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_artista_nao_cria_lancamento_financeiro(self, client: AsyncClient):
        authed = await _get_auth_client(client, ARTISTA_EMAIL)
        r = await authed.post(
            "/api/v1/financeiro/",
            json={"tipo": "ENTRADA", "descricao": "x", "valor": 50.0},
        )
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_recepcionista_nao_acessa_relatorios(self, client: AsyncClient):
        authed = await _get_auth_client(client, RECEPCIONISTA_EMAIL)
        r = await authed.get("/api/v1/relatorios/resumo")
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_acessa_relatorios(self, client: AsyncClient):
        authed = await _get_auth_client(client, ADMIN_EMAIL)
        r = await authed.get("/api/v1/relatorios/resumo")
        assert r.status_code == 200


class TestOwnerCheckArtista:
    """P0-03 incremental — ARTISTA acessa apenas recursos vinculados a usuario.id."""

    @pytest.mark.asyncio
    async def test_artista_ve_apenas_portfolio_flash_e_agenda_proprios(
        self,
        client: AsyncClient,
    ):
        marcador = uuid.uuid4().hex[:8]

        async with async_session() as session:
            artista = await session.scalar(select(Usuario).where(Usuario.email == ARTISTA_EMAIL))
            assert artista is not None

            outro_artista = Usuario(
                estudio_id=artista.estudio_id,
                nome=f"Outro Artista {marcador}",
                email=f"outro-artista-{marcador}@sessaoink.dev",
                senha_hash=hash_senha(SENHA),
                tipo=TipoUsuario.ARTISTA,
            )
            session.add(outro_artista)
            await session.flush()

            portfolio_proprio = Portfolio(
                estudio_id=artista.estudio_id,
                artista_id=artista.id,
                imagem_path=f"portfolio-proprio-{marcador}.webp",
                titulo=f"Portfolio proprio {marcador}",
            )
            portfolio_outro = Portfolio(
                estudio_id=artista.estudio_id,
                artista_id=outro_artista.id,
                imagem_path=f"portfolio-outro-{marcador}.webp",
                titulo=f"Portfolio outro {marcador}",
            )
            flash_propria = FlashArt(
                estudio_id=artista.estudio_id,
                artista_id=artista.id,
                titulo=f"Flash propria {marcador}",
            )
            flash_outra = FlashArt(
                estudio_id=artista.estudio_id,
                artista_id=outro_artista.id,
                titulo=f"Flash outra {marcador}",
            )
            agenda_propria = Atendimento(
                estudio_id=artista.estudio_id,
                artista_id=artista.id,
                status_operacional=StatusOperacional.CONFIRMADO,
                tipo=TipoAtendimento.TATUAGEM,
                descricao=f"Agenda propria {marcador}",
                data_sessao=datetime(2026, 7, 10, 14, 0, tzinfo=UTC),
            )
            agenda_outra = Atendimento(
                estudio_id=artista.estudio_id,
                artista_id=outro_artista.id,
                status_operacional=StatusOperacional.CONFIRMADO,
                tipo=TipoAtendimento.TATUAGEM,
                descricao=f"Agenda outra {marcador}",
                data_sessao=datetime(2026, 7, 11, 14, 0, tzinfo=UTC),
            )
            session.add_all(
                [
                    portfolio_proprio,
                    portfolio_outro,
                    flash_propria,
                    flash_outra,
                    agenda_propria,
                    agenda_outra,
                ]
            )
            await session.commit()
            portfolio_outro_id = portfolio_outro.id
            flash_outra_id = flash_outra.id
            agenda_outra_id = agenda_outra.id

        authed = await _get_auth_client(client, ARTISTA_EMAIL)

        portfolio_resp = await authed.get("/api/v1/portfolio/")
        assert portfolio_resp.status_code == 200
        titulos_portfolio = {item["titulo"] for item in portfolio_resp.json()}
        assert f"Portfolio proprio {marcador}" in titulos_portfolio
        assert f"Portfolio outro {marcador}" not in titulos_portfolio

        flash_resp = await authed.get("/api/v1/flash-arts/")
        assert flash_resp.status_code == 200
        titulos_flash = {item["titulo"] for item in flash_resp.json()}
        assert f"Flash propria {marcador}" in titulos_flash
        assert f"Flash outra {marcador}" not in titulos_flash

        agenda_resp = await authed.get("/api/v1/agenda/?ano=2026&mes=7")
        assert agenda_resp.status_code == 200
        descricoes_agenda = {item["descricao"] for item in agenda_resp.json()["sessoes"]}
        assert f"Agenda propria {marcador}" in descricoes_agenda
        assert f"Agenda outra {marcador}" not in descricoes_agenda

        delete_portfolio = await authed.delete(f"/api/v1/portfolio/{portfolio_outro_id}")
        assert delete_portfolio.status_code == 404

        patch_flash = await authed.patch(
            f"/api/v1/flash-arts/{flash_outra_id}/status?status_novo=ARQUIVADA"
        )
        assert patch_flash.status_code == 404

        agenda_outro = await authed.post(
            "/api/v1/agenda/agendar",
            json={
                "atendimento_id": str(agenda_outra_id),
                "data_sessao": "2026-07-12T14:00:00Z",
                "duracao_minutos": 120,
            },
        )
        assert agenda_outro.status_code == 404
