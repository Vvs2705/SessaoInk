"""Testes de integração e segurança para auditoria e isolamento (SessãoInk)."""

import pytest
import uuid
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
from fastapi import status

from app.models.usuario import Usuario, Estudio
from app.models.cliente import Cliente
from app.models.atendimento import Atendimento
from app.models.documento import Documento
from app.models.financeiro import Lancamento


class TestSecurityAndSpamControls:
    @pytest.mark.asyncio
    @patch("app.api.v1.publico.router.verificar_limite_orcamento", return_value=False)
    @patch("app.api.v1.publico.router.registrar_solicitacao_orcamento")
    async def test_orcamento_publico_honeypot_triggered(
        self,
        mock_register,
        mock_verify,
        client: AsyncClient
    ):
        """POST /public/{slug}/orcamento deve retornar 400 se honeypots forem preenchidos."""
        # Se preencher o campo email_confirm (honeypot)
        r1 = await client.post(
            "/api/v1/public/demo/orcamento",
            data={
                "nome": "Visitante Spam",
                "whatsapp": "11988887777",
                "descricao": "Quero uma tatuagem",
                "aceite_privacidade": "true",
                "aceite_termos": "true",
                "email_confirm": "spam@bot.com",
            },
        )
        assert r1.status_code == 400
        assert "Spam detectado" in r1.text or "spam detectado" in r1.text

        # Se preencher o campo website (honeypot)
        r2 = await client.post(
            "/api/v1/public/demo/orcamento",
            data={
                "nome": "Visitante Spam 2",
                "whatsapp": "11988887777",
                "descricao": "Quero uma tatuagem",
                "aceite_privacidade": "true",
                "aceite_termos": "true",
                "website": "http://spambot.com",
            },
        )
        assert r2.status_code == 400
        assert "Spam detectado" in r2.text or "spam detectado" in r2.text

    @pytest.mark.asyncio
    @patch("app.api.v1.publico.router.verificar_limite_orcamento", return_value=True)
    async def test_orcamento_publico_rate_limit_triggered(
        self,
        mock_verify,
        client: AsyncClient
    ):
        """POST /public/{slug}/orcamento deve retornar 429 se o IP estiver com rate limit excedido."""
        r = await client.post(
            "/api/v1/public/demo/orcamento",
            data={
                "nome": "Visitante Fiel",
                "whatsapp": "11988887777",
                "descricao": "Quero uma tatuagem",
                "aceite_privacidade": "true",
                "aceite_termos": "true",
            },
        )
        assert r.status_code == 429
        assert "Muitas solicitações" in r.json()["detail"]


class TestTenantIsolationIDCrossing:
    @pytest.mark.asyncio
    async def test_criar_atendimento_com_cliente_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /atendimentos/ deve retornar 400 ao tentar cruzar com cliente de outro estúdio."""
        # Tenta usar um UUID aleatório/inexistente (que é interpretado como não pertencente ao estúdio)
        fake_client_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/atendimentos/",
            json={
                "cliente_id": str(fake_client_id),
                "descricao": "Tentativa de cruzamento de tenant",
                "tipo": "TATUAGEM",
            },
        )
        assert r.status_code == 400
        assert "Cliente inválido" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_criar_atendimento_com_artista_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /atendimentos/ deve retornar 400 ao tentar cruzar com artista/usuário de outro estúdio."""
        fake_artista_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/atendimentos/",
            json={
                "artista_id": str(fake_artista_id),
                "descricao": "Tentativa de cruzamento de artista",
                "tipo": "TATUAGEM",
            },
        )
        assert r.status_code == 400
        assert "Artista inválido" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_criar_documento_com_cliente_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /documentos/ deve retornar 400 ao tentar vincular a um cliente inexistente/de outro estúdio."""
        fake_client_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/documentos/",
            json={
                "tipo": "CONSENTIMENTO",
                "titulo": "Termo Malicioso",
                "versao": "1.0",
                "cliente_id": str(fake_client_id),
            },
        )
        assert r.status_code == 400
        assert "Cliente inválido" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_criar_documento_com_atendimento_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /documentos/ deve retornar 400 ao tentar vincular a um atendimento inexistente/de outro estúdio."""
        fake_atendimento_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/documentos/",
            json={
                "tipo": "CONSENTIMENTO",
                "titulo": "Termo Malicioso 2",
                "versao": "1.0",
                "atendimento_id": str(fake_atendimento_id),
            },
        )
        assert r.status_code == 400
        assert "Atendimento inválido" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_criar_lancamento_com_atendimento_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /financeiro/ deve retornar 400 ao tentar vincular a um atendimento inexistente/de outro estúdio."""
        fake_atendimento_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/financeiro/",
            json={
                "tipo": "ENTRADA",
                "descricao": "Lançamento Malicioso",
                "valor": 250.0,
                "atendimento_id": str(fake_atendimento_id),
            },
        )
        assert r.status_code == 400
        assert "Atendimento inválido" in r.json()["detail"]

    @pytest.mark.asyncio
    async def test_criar_lancamento_com_artista_de_outro_estudio(self, autenticado: AsyncClient):
        """POST /financeiro/ deve retornar 400 ao tentar vincular a um artista inexistente/de outro estúdio."""
        fake_artista_id = uuid.uuid4()
        
        r = await autenticado.post(
            "/api/v1/financeiro/",
            json={
                "tipo": "ENTRADA",
                "descricao": "Lançamento Malicioso 2",
                "valor": 150.0,
                "artista_id": str(fake_artista_id),
            },
        )
        assert r.status_code == 400
        assert "Artista inválido" in r.json()["detail"]
