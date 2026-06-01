"""Testes de integração para as correções aplicadas (Documentos Públicos e Conflitos de Agenda)."""

import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta


class TestDocumentosPublicos:
    async def test_fluxo_documento_publico_e_assinatura(self, autenticado: AsyncClient, client: AsyncClient):
        # 1. Criar documento pelo painel autenticado
        doc_resp = await autenticado.post(
            "/api/v1/documentos/",
            json={
                "tipo": "CONSENTIMENTO",
                "titulo": "Termo de Consentimento de Tatuagem Realista",
                "conteudo": "Eu aceito fazer o procedimento de tatuagem...",
                "versao": "1.0",
            },
        )
        assert doc_resp.status_code == 201, doc_resp.text
        doc_data = doc_resp.json()
        doc_id = doc_data["id"]
        assert doc_data["assinado"] is False

        # 1.5 Gerar link de acesso seguro (token)
        link_resp = await autenticado.post(
            f"/api/v1/documentos/{doc_id}/gerar-link",
            params={"acao": "ASSINAR"}
        )
        assert link_resp.status_code == 200, link_resp.text
        token = link_resp.json()["token"]

        # 2. Obter documento publicamente via token sem auth
        pub_get = await client.get(f"/api/v1/public/documentos/token/{token}")
        assert pub_get.status_code == 200, pub_get.text
        pub_data = pub_get.json()
        assert pub_data["titulo"] == "Termo de Consentimento de Tatuagem Realista"
        assert pub_data["assinado"] is False

        # 3. Assinar o documento de forma pública via Form
        assinar_resp = await client.post(
            f"/api/v1/public/documentos/token/{token}/assinar",
            data={
                "nome_assinante": "João da Silva Teste",
            },
        )
        assert assinar_resp.status_code == 200, assinar_resp.text
        assert "sucesso" in assinar_resp.json()["message"]

        # 4. Verificar se o documento agora consta como assinado
        pub_get_signed = await client.get(f"/api/v1/public/documentos/token/{token}")
        assert pub_get_signed.status_code == 200
        assert pub_get_signed.json()["assinado"] is True
        assert pub_get_signed.json()["data_assinatura"] is not None


class TestAgendaConflitos:
    async def test_conflito_de_horario_artista(self, autenticado: AsyncClient):
        # Obter ID do artista (usuário logado)
        me_resp = await autenticado.get("/api/v1/auth/me")
        me_data = me_resp.json()
        artista_id = me_data["id"]

        # 1. Criar dois atendimentos para o mesmo artista
        atend1_resp = await autenticado.post(
            "/api/v1/atendimentos/",
            json={
                "artista_id": artista_id,
                "descricao": "Atendimento 1 - Pytest",
                "tipo": "TATUAGEM",
            },
        )
        assert atend1_resp.status_code == 201
        atend1_id = atend1_resp.json()["id"]

        atend2_resp = await autenticado.post(
            "/api/v1/atendimentos/",
            json={
                "artista_id": artista_id,
                "descricao": "Atendimento 2 - Pytest",
                "tipo": "TATUAGEM",
            },
        )
        assert atend2_resp.status_code == 201
        atend2_id = atend2_resp.json()["id"]

        # Definir horário de sessão
        data_sessao_base = datetime.now(timezone.utc) + timedelta(days=5)

        # 2. Agendar primeira sessão (das 14:00 às 16:00)
        agendar1_resp = await autenticado.post(
            "/api/v1/agenda/agendar",
            json={
                "atendimento_id": atend1_id,
                "data_sessao": data_sessao_base.isoformat(),
                "duracao_minutos": 120,
            },
        )
        assert agendar1_resp.status_code == 200, agendar1_resp.text

        # 3. Tentar agendar segunda sessão com sobreposição (das 15:00 às 17:00) - deve dar 409
        data_sessao_sobreposta = data_sessao_base + timedelta(hours=1)
        agendar2_resp = await autenticado.post(
            "/api/v1/agenda/agendar",
            json={
                "atendimento_id": atend2_id,
                "data_sessao": data_sessao_sobreposta.isoformat(),
                "duracao_minutos": 120,
            },
        )
        assert agendar2_resp.status_code == 409, agendar2_resp.text
        assert "Conflito" in agendar2_resp.json()["detail"]
