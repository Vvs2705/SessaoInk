"""Regressoes dos helpers tenant-scoped centralizados."""

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.database import async_session
from app.models.atendimento import Atendimento, TipoAtendimento
from app.models.cliente import Cliente
from app.models.documento import Documento, TipoDocumento
from app.models.financeiro import Lancamento, TipoLancamento
from app.models.usuario import Estudio
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_cliente_do_estudio,
    get_documento_do_estudio,
    get_lancamento_do_estudio,
)


@pytest.fixture(scope="session", autouse=True)
async def seed_tenant_helper_data(setup_test_database):
    async with async_session() as session:
        demo = await session.scalar(select(Estudio).where(Estudio.slug == "demo"))
        assert demo is not None

        invasor = Estudio(
            nome="Estudio Tenant Helper Invasor",
            slug="tenant-helper-invasor",
            bio="Dados usados para testar isolamento",
            cidade="Curitiba",
            uf="PR",
        )
        session.add(invasor)
        await session.flush()

        cliente_demo = Cliente(
            estudio_id=demo.id,
            nome="Tenant Helper Cliente Demo",
            email="tenant-helper-demo@example.com",
        )
        cliente_invasor = Cliente(
            estudio_id=invasor.id,
            nome="Tenant Helper Cliente Invasor",
            email="tenant-helper-invasor@example.com",
        )
        session.add_all([cliente_demo, cliente_invasor])
        await session.flush()

        atendimento_demo = Atendimento(
            estudio_id=demo.id,
            cliente_id=cliente_demo.id,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Tenant helper atendimento demo",
        )
        atendimento_invasor = Atendimento(
            estudio_id=invasor.id,
            cliente_id=cliente_invasor.id,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Tenant helper atendimento invasor",
        )
        session.add_all([atendimento_demo, atendimento_invasor])
        await session.flush()

        documento_demo = Documento(
            estudio_id=demo.id,
            cliente_id=cliente_demo.id,
            tipo=TipoDocumento.CONSENTIMENTO,
            titulo="Tenant Helper Documento Demo",
            versao="1.0",
        )
        documento_invasor = Documento(
            estudio_id=invasor.id,
            cliente_id=cliente_invasor.id,
            tipo=TipoDocumento.CONSENTIMENTO,
            titulo="Tenant Helper Documento Invasor",
            versao="1.0",
        )
        session.add_all([documento_demo, documento_invasor])

        lancamento_demo = Lancamento(
            estudio_id=demo.id,
            tipo=TipoLancamento.ENTRADA,
            descricao="Tenant Helper Lancamento Demo",
            valor=100.0,
        )
        lancamento_invasor = Lancamento(
            estudio_id=invasor.id,
            tipo=TipoLancamento.ENTRADA,
            descricao="Tenant Helper Lancamento Invasor",
            valor=100.0,
        )
        session.add_all([lancamento_demo, lancamento_invasor])
        await session.commit()


async def _estudios():
    async with async_session() as session:
        demo = await session.scalar(select(Estudio).where(Estudio.slug == "demo"))
        invasor = await session.scalar(
            select(Estudio).where(Estudio.slug == "tenant-helper-invasor")
        )
        assert demo is not None
        assert invasor is not None
        return demo, invasor


class TestTenantHelpers:
    @pytest.mark.asyncio
    async def test_cliente_do_estudio_bloqueia_cross_tenant(self):
        demo, invasor = await _estudios()
        async with async_session() as session:
            cliente = await session.scalar(
                select(Cliente).where(Cliente.nome == "Tenant Helper Cliente Demo")
            )
            assert cliente is not None

            assert await get_cliente_do_estudio(
                session,
                cliente_id=cliente.id,
                estudio_id=demo.id,
            )

            with pytest.raises(HTTPException) as exc:
                await get_cliente_do_estudio(
                    session,
                    cliente_id=cliente.id,
                    estudio_id=invasor.id,
                )
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_atendimento_do_estudio_bloqueia_cross_tenant(self):
        demo, invasor = await _estudios()
        async with async_session() as session:
            atendimento = await session.scalar(
                select(Atendimento).where(
                    Atendimento.descricao == "Tenant helper atendimento demo"
                )
            )
            assert atendimento is not None

            assert await get_atendimento_do_estudio(
                session,
                atendimento_id=atendimento.id,
                estudio_id=demo.id,
            )

            with pytest.raises(HTTPException) as exc:
                await get_atendimento_do_estudio(
                    session,
                    atendimento_id=atendimento.id,
                    estudio_id=invasor.id,
                )
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_documento_do_estudio_bloqueia_cross_tenant(self):
        demo, invasor = await _estudios()
        async with async_session() as session:
            documento = await session.scalar(
                select(Documento).where(
                    Documento.titulo == "Tenant Helper Documento Demo"
                )
            )
            assert documento is not None

            assert await get_documento_do_estudio(
                session,
                documento_id=documento.id,
                estudio_id=demo.id,
            )

            with pytest.raises(HTTPException) as exc:
                await get_documento_do_estudio(
                    session,
                    documento_id=documento.id,
                    estudio_id=invasor.id,
                )
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_lancamento_do_estudio_bloqueia_cross_tenant(self):
        demo, invasor = await _estudios()
        async with async_session() as session:
            lancamento = await session.scalar(
                select(Lancamento).where(
                    Lancamento.descricao == "Tenant Helper Lancamento Demo"
                )
            )
            assert lancamento is not None

            assert await get_lancamento_do_estudio(
                session,
                lancamento_id=lancamento.id,
                estudio_id=demo.id,
            )

            with pytest.raises(HTTPException) as exc:
                await get_lancamento_do_estudio(
                    session,
                    lancamento_id=lancamento.id,
                    estudio_id=invasor.id,
                )
            assert exc.value.status_code == 404
