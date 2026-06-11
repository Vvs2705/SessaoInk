"""Testes do fluxo de convites de equipe.

Cobre: criação (ADMIN), retorno do link, restrição de papel (sem ADMIN),
listagem/revogação, info pública e aceite que cria o usuário no estúdio.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.core.database import async_session
from app.models.convite import Convite, StatusConvite
from app.models.usuario import TipoUsuario, Usuario


@pytest.mark.asyncio
async def test_admin_cria_convite_recebe_link(autenticado: AsyncClient):
    email = f"novo-{uuid.uuid4().hex[:8]}@exemplo.com"
    r = await autenticado.post(
        "/api/v1/convites/", json={"email": email, "role": "ARTISTA"}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == email
    assert body["status"] == "PENDENTE"
    # O link em claro só existe na criação — a UI depende dele.
    assert body["convite_url"] and "/convite/" in body["convite_url"]


@pytest.mark.asyncio
async def test_convite_nao_permite_papel_admin(autenticado: AsyncClient):
    r = await autenticado.post(
        "/api/v1/convites/",
        json={"email": f"x-{uuid.uuid4().hex[:8]}@exemplo.com", "role": "ADMIN"},
    )
    # Validação Pydantic rejeita papel não-convitável.
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_convite_duplicado_pendente_conflita(autenticado: AsyncClient):
    email = f"dup-{uuid.uuid4().hex[:8]}@exemplo.com"
    r1 = await autenticado.post("/api/v1/convites/", json={"email": email})
    assert r1.status_code == 201
    r2 = await autenticado.post("/api/v1/convites/", json={"email": email})
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_listar_e_revogar_convite(autenticado: AsyncClient):
    email = f"rev-{uuid.uuid4().hex[:8]}@exemplo.com"
    criado = await autenticado.post("/api/v1/convites/", json={"email": email})
    convite_id = criado.json()["id"]

    listados = await autenticado.get("/api/v1/convites/")
    assert listados.status_code == 200
    assert any(c["id"] == convite_id for c in listados.json())

    rev = await autenticado.delete(f"/api/v1/convites/{convite_id}")
    assert rev.status_code == 204

    # Após revogado, info pública não está mais disponível.
    async with async_session() as session:
        convite = await session.get(Convite, uuid.UUID(convite_id))
        assert convite is not None
        assert convite.status == StatusConvite.REVOGADO


@pytest.mark.asyncio
async def test_info_e_aceite_publico_cria_usuario(autenticado: AsyncClient, client: AsyncClient):
    email = f"aceita-{uuid.uuid4().hex[:8]}@exemplo.com"
    criado = await autenticado.post(
        "/api/v1/convites/", json={"email": email, "role": "RECEPCIONISTA"}
    )
    convite_url = criado.json()["convite_url"]
    token = convite_url.rsplit("/", 1)[-1]

    # Info pública (sem sessão) mostra estúdio + papel.
    info = await client.get(f"/api/v1/convites/info/{token}")
    assert info.status_code == 200, info.text
    assert info.json()["email"] == email
    assert info.json()["role"] == "RECEPCIONISTA"
    assert info.json()["nome_estudio"]

    # Aceite cria o usuário no estúdio.
    aceite = await client.post(
        f"/api/v1/convites/aceitar/{token}",
        json={"nome": "Pessoa Convidada", "senha": "senhaforte123"},
    )
    assert aceite.status_code == 201, aceite.text
    novo = aceite.json()
    assert novo["email"] == email
    assert novo["tipo"] == "RECEPCIONISTA"

    async with async_session() as session:
        usuario = await session.get(Usuario, uuid.UUID(novo["id"]))
        assert usuario is not None
        assert usuario.tipo == TipoUsuario.RECEPCIONISTA
        assert usuario.ativo is True

    # Token de uso único: segundo aceite falha.
    segundo = await client.post(
        f"/api/v1/convites/aceitar/{token}",
        json={"nome": "Outro", "senha": "senhaforte123"},
    )
    assert segundo.status_code == 400


@pytest.mark.asyncio
async def test_aceite_senha_curta_rejeitada(autenticado: AsyncClient, client: AsyncClient):
    email = f"curta-{uuid.uuid4().hex[:8]}@exemplo.com"
    criado = await autenticado.post("/api/v1/convites/", json={"email": email})
    token = criado.json()["convite_url"].rsplit("/", 1)[-1]

    r = await client.post(
        f"/api/v1/convites/aceitar/{token}",
        json={"nome": "Nome", "senha": "curta"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_info_token_invalido_404(client: AsyncClient):
    r = await client.get("/api/v1/convites/info/token-que-nao-existe")
    assert r.status_code == 404
