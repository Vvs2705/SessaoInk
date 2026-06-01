"""Testes LGPD para orcamentos publicos."""

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.atendimento import (
    Atendimento,
    AtendimentoImagem,
    StatusOperacional,
    TipoAtendimento,
)
from app.models.cliente import Cliente
from app.models.consentimento import Consentimento
from app.models.usuario import Estudio
from app.services import lgpd
from app.services.lgpd import anonimizar_orcamentos_publicos_expirados


@pytest.mark.asyncio
@patch("app.api.v1.publico.router.verificar_limite_orcamento", return_value=False)
@patch("app.api.v1.publico.router.registrar_solicitacao_orcamento")
async def test_orcamento_publico_registra_retencao_e_consentimento(
    mock_register,
    mock_verify,
    client: AsyncClient,
):
    resposta = await client.post(
        "/api/v1/public/demo/orcamento",
        data={
            "nome": "Visitante LGPD",
            "whatsapp": "11988887777",
            "descricao": "Quero uma tatuagem geometrica",
            "aceite_privacidade": "true",
            "aceite_termos": "true",
        },
    )

    assert resposta.status_code == 201, resposta.text
    atendimento_id = uuid.UUID(resposta.json()["atendimento_id"])

    async with async_session() as session:
        atendimento = await session.get(Atendimento, atendimento_id)
        assert atendimento is not None
        assert atendimento.orcamento_publico is True
        assert atendimento.lgpd_retencao_ate is not None
        assert atendimento.lgpd_anonimizado_em is None

        consentimento = await session.scalar(
            select(Consentimento).where(
                Consentimento.atendimento_id == atendimento_id,
                Consentimento.origem == "orcamento_publico",
            )
        )

        assert consentimento is not None
        assert consentimento.aceite_privacidade is True
        assert consentimento.aceite_termos is True
        assert consentimento.ip_hash is not None
        assert consentimento.user_agent_hash is not None


@pytest.mark.asyncio
async def test_anonimiza_apenas_orcamentos_publicos_nao_convertidos_expirados():
    agora = datetime(2026, 6, 1, tzinfo=UTC)

    async with async_session() as session:
        estudio = Estudio(nome="LGPD Ink", slug="lgpd-ink")
        session.add(estudio)
        await session.flush()

        cliente = Cliente(estudio_id=estudio.id, nome="Cliente Convertido")
        session.add(cliente)
        await session.flush()

        expirado = Atendimento(
            estudio_id=estudio.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Tatuagem com dado pessoal no texto",
            notas_privadas="Contato: Pessoa Expirada | WhatsApp: 11999999999",
            orcamento_publico=True,
            lgpd_retencao_ate=agora - timedelta(days=1),
        )
        convertido = Atendimento(
            estudio_id=estudio.id,
            cliente_id=cliente.id,
            status_operacional=StatusOperacional.CONFIRMADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Orcamento convertido",
            notas_privadas="Contato: Cliente Convertido | WhatsApp: 11888888888",
            orcamento_publico=True,
            lgpd_retencao_ate=agora - timedelta(days=1),
        )
        recente = Atendimento(
            estudio_id=estudio.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Orcamento recente",
            notas_privadas="Contato: Pessoa Recente | WhatsApp: 11777777777",
            orcamento_publico=True,
            lgpd_retencao_ate=agora + timedelta(days=1),
        )
        session.add_all([expirado, convertido, recente])
        await session.commit()

        resultado = await anonimizar_orcamentos_publicos_expirados(
            session,
            agora=agora,
        )

        assert resultado.anonimizados == 1
        await session.refresh(expirado)
        await session.refresh(convertido)
        await session.refresh(recente)

        assert expirado.lgpd_anonimizado_em is not None
        assert expirado.lgpd_anonimizado_em.replace(tzinfo=UTC) == agora
        assert expirado.notas_privadas == "[anonimizado LGPD]"
        assert expirado.descricao is None
        assert expirado.parte_corpo is None
        assert expirado.estilo is None
        assert expirado.tamanho_cm is None

        assert convertido.lgpd_anonimizado_em is None
        assert convertido.notas_privadas == "Contato: Cliente Convertido | WhatsApp: 11888888888"
        assert recente.lgpd_anonimizado_em is None
        assert recente.notas_privadas == "Contato: Pessoa Recente | WhatsApp: 11777777777"


@pytest.mark.asyncio
async def test_anonimizacao_remove_arquivo_fisico_de_imagem(monkeypatch):
    agora = datetime(2026, 6, 1, tzinfo=UTC)
    storage_path = Path(__file__).resolve().parents[2] / ".tmp" / "lgpd-images"
    monkeypatch.setattr(settings, "STORAGE_PATH", str(storage_path))

    async with async_session() as session:
        estudio = Estudio(nome="LGPD Image Ink", slug="lgpd-image-ink")
        session.add(estudio)
        await session.flush()

        atendimento = Atendimento(
            estudio_id=estudio.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Imagem de referencia com dado pessoal",
            notas_privadas="Contato: Pessoa Imagem | WhatsApp: 11666666666",
            orcamento_publico=True,
            lgpd_retencao_ate=agora - timedelta(days=1),
        )
        session.add(atendimento)
        await session.flush()

        upload_dir = (
            storage_path
            / "uploads"
            / str(estudio.id)
            / "atendimentos"
            / str(atendimento.id)
        )
        upload_dir.mkdir(parents=True, exist_ok=True)
        imagem_path = upload_dir / "referencia.webp"
        imagem_path.write_bytes(b"fake image bytes")

        imagem = AtendimentoImagem(
            atendimento_id=atendimento.id,
            imagem_path=imagem_path.name,
        )
        session.add(imagem)
        await session.commit()

        resultado = await anonimizar_orcamentos_publicos_expirados(
            session,
            agora=agora,
        )

        assert resultado.anonimizados >= 1
        assert not imagem_path.exists()
        await session.refresh(imagem)
        assert imagem.ativo is False
        assert imagem.imagem_path == "[anonimizado LGPD]"


@pytest.mark.asyncio
async def test_anonimizacao_mantem_retry_se_remocao_fisica_falhar(monkeypatch):
    agora = datetime(2026, 6, 1, tzinfo=UTC)
    monkeypatch.setattr(lgpd, "_remover_imagem_atendimento", lambda *_args: False)

    async with async_session() as session:
        estudio = Estudio(nome="LGPD Retry Ink", slug="lgpd-retry-ink")
        session.add(estudio)
        await session.flush()

        atendimento = Atendimento(
            estudio_id=estudio.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            descricao="Imagem que falha remocao",
            notas_privadas="Contato: Pessoa Retry | WhatsApp: 11555555555",
            orcamento_publico=True,
            lgpd_retencao_ate=agora - timedelta(days=1),
        )
        session.add(atendimento)
        await session.flush()

        imagem = AtendimentoImagem(
            atendimento_id=atendimento.id,
            imagem_path="referencia-com-falha.webp",
        )
        session.add(imagem)
        await session.commit()

        await anonimizar_orcamentos_publicos_expirados(session, agora=agora)

        await session.refresh(atendimento)
        await session.refresh(imagem)
        assert atendimento.lgpd_anonimizado_em is None
        assert atendimento.notas_privadas == "[anonimizado LGPD]"
        assert imagem.ativo is False
        assert imagem.imagem_path == "referencia-com-falha.webp"


@pytest.mark.asyncio
async def test_modela_consentimento_de_orcamento_publico():
    async with async_session() as session:
        estudio = Estudio(nome="Consent Ink", slug="consent-ink")
        session.add(estudio)
        await session.flush()

        atendimento = Atendimento(
            estudio_id=estudio.id,
            status_operacional=StatusOperacional.SOLICITADO,
            tipo=TipoAtendimento.TATUAGEM,
            orcamento_publico=True,
        )
        session.add(atendimento)
        await session.flush()

        consentimento = Consentimento(
            estudio_id=estudio.id,
            atendimento_id=atendimento.id,
            origem="orcamento_publico",
            aceite_privacidade=True,
            aceite_termos=True,
            versao_privacidade="2026-06-01",
            versao_termos="2026-06-01",
        )
        session.add(consentimento)
        await session.commit()

        assert consentimento.id is not None
