"""Testes de integração para financeiro e dashboard (Track B)."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient


class TestFinanceiroAndDashboard:
    async def test_crud_lancamento_financeiro(self, autenticado: AsyncClient):
        # 1. Criar Lançamento de Entrada
        dados_entrada = {
            "tipo": "ENTRADA",
            "descricao": "Tattoo Dragão João",
            "valor": 500.00,
            "status": "PENDENTE",
            "forma_pagamento": "PIX",
            "data_prevista": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            "categoria": "SERVICO_TATUAGEM",
            "centro_custo": "ESTUDIO",
            "valor_bruto": 500.00,
            "valor_taxa": 10.00,
            "valor_liquido": 490.00
        }
        res_create = await autenticado.post("/api/v1/financeiro/", json=dados_entrada)
        assert res_create.status_code == 201
        lanc = res_create.json()
        assert lanc["descricao"] == "Tattoo Dragão João"
        assert lanc["valor"] == 500.00
        assert lanc["valor_liquido"] == 490.00
        assert lanc["categoria"] == "SERVICO_TATUAGEM"
        assert lanc["status"] == "PENDENTE"
        lanc_id = lanc["id"]

        # 2. Listar Lançamentos com Filtro
        res_list = await autenticado.get("/api/v1/financeiro/?tipo=ENTRADA")
        assert res_list.status_code == 200
        assert len(res_list.json()) >= 1
        assert any(item["id"] == lanc_id for item in res_list.json())

        # 3. Atualizar Lançamento para Pago (deve registrar data_realizada)
        res_update = await autenticado.patch(
            f"/api/v1/financeiro/{lanc_id}",
            json={"status": "PAGO", "descricao": "Tattoo Dragão João - Pago"}
        )
        assert res_update.status_code == 200
        lanc_updated = res_update.json()
        assert lanc_updated["status"] == "PAGO"
        assert lanc_updated["data_realizada"] is not None
        assert lanc_updated["descricao"] == "Tattoo Dragão João - Pago"

        # 4. Deletar Lançamento
        res_delete = await autenticado.delete(f"/api/v1/financeiro/{lanc_id}")
        assert res_delete.status_code == 204

    async def test_patch_recalcula_valor_liquido(self, autenticado: AsyncClient):
        """Regressão: PATCH em valor/valor_taxa recomputa valor_liquido sem
        misturar Decimal (vindo do banco) com float (Decimal - float -> TypeError)."""
        res_create = await autenticado.post("/api/v1/financeiro/", json={
            "tipo": "ENTRADA",
            "descricao": "Recalc líquido",
            "valor": 500.00,
            "status": "PENDENTE",
            "valor_bruto": 500.00,
            "valor_taxa": 10.00,
            "valor_liquido": 490.00,
        })
        assert res_create.status_code == 201
        lanc_id = res_create.json()["id"]

        # PATCH só na taxa: bruto vem do banco (Decimal), taxa do payload.
        res_taxa = await autenticado.patch(
            f"/api/v1/financeiro/{lanc_id}", json={"valor_taxa": 25.00}
        )
        assert res_taxa.status_code == 200
        assert res_taxa.json()["valor_liquido"] == 475.00

        # PATCH só no bruto: bruto do payload, taxa persistida no banco (Decimal).
        res_bruto = await autenticado.patch(
            f"/api/v1/financeiro/{lanc_id}", json={"valor_bruto": 600.00}
        )
        assert res_bruto.status_code == 200
        assert res_bruto.json()["valor_liquido"] == 575.00

    async def test_sub_endpoints_filtrados(self, autenticado: AsyncClient):
        # Criar uma entrada e uma saída
        await autenticado.post("/api/v1/financeiro/", json={
            "tipo": "ENTRADA", "descricao": "Entrada SubTest", "valor": 100.00, "status": "PAGO"
        })
        await autenticado.post("/api/v1/financeiro/", json={
            "tipo": "SAIDA", "descricao": "Saida SubTest", "valor": 50.00, "status": "PAGO", "categoria": "MATERIAL"
        })

        # Testar sub-endpoints
        r_ent = await autenticado.get("/api/v1/financeiro/entradas")
        assert r_ent.status_code == 200
        assert any(item["descricao"] == "Entrada SubTest" for item in r_ent.json())

        r_sai = await autenticado.get("/api/v1/financeiro/saidas")
        assert r_sai.status_code == 200
        assert any(item["descricao"] == "Saida SubTest" for item in r_sai.json())

    async def test_consolidado_financeiro(self, autenticado: AsyncClient):
        hoje = datetime.now(UTC).date().isoformat()
        res = await autenticado.get(f"/api/v1/financeiro/consolidado?inicio={hoje}&fim={hoje}")
        assert res.status_code == 200
        dados = res.json()
        assert "resumo" in dados
        assert "graficos" in dados
        assert "entradas_pagas" in dados["resumo"]
        assert "fluxo_diario" in dados["graficos"]

    async def test_geracao_e_pagamento_de_comissoes(self, autenticado: AsyncClient):
        # Precisamos de um atendimento_id e artista_id válidos.
        # Vamos buscar um artista_id no próprio estúdio.
        res_perfil = await autenticado.get("/api/v1/usuarios/me")
        if res_perfil.status_code != 200:
            res_perfil = await autenticado.get("/api/v1/auth/me")

        artista_id = res_perfil.json()["id"]

        # Criar atendimento mock
        # Para criar atendimento, precisamos de um cliente.
        res_cli = await autenticado.post("/api/v1/clientes/", json={
            "nome": "Cliente Teste Comissão", "email": "cli.comissao@test.com", "telefone": "11999999999"
        })
        assert res_cli.status_code == 201
        cliente_id = res_cli.json()["id"]

        res_atend = await autenticado.post("/api/v1/atendimentos/", json={
            "cliente_id": cliente_id,
            "artista_id": artista_id,
            "tipo": "TATUAGEM",
            "valor_total": 400.00,
            "data_sessao": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        })
        assert res_atend.status_code == 201
        atend_id = res_atend.json()["id"]

        # Gerar Comissão
        req_gerar = {
            "artista_id": artista_id,
            "atendimento_id": atend_id,
            "valor_servico": 400.00,
            "comissao_percentual": 50.0,
            "descricao": "Comissão de 50% sobre dragão"
        }
        res_com = await autenticado.post("/api/v1/financeiro/comissoes/gerar", json=req_gerar)
        assert res_com.status_code == 201
        comissao = res_com.json()
        assert comissao["tipo"] == "COMISSAO"
        assert comissao["valor"] == 200.00
        assert comissao["status"] == "PENDENTE"
        com_id = comissao["id"]

        # Pagar Comissão
        res_pagar = await autenticado.patch(f"/api/v1/financeiro/comissoes/{com_id}/pagar")
        assert res_pagar.status_code == 200
        assert res_pagar.json()["status"] == "PAGO"

    async def test_exportar_csv(self, autenticado: AsyncClient):
        hoje = datetime.now(UTC).date().isoformat()
        res = await autenticado.get(f"/api/v1/financeiro/exportar?data_inicio={hoje}&data_fim={hoje}")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert len(res.content) > 0

    async def test_dashboard_resumo(self, autenticado: AsyncClient):
        hoje = datetime.now(UTC).date().isoformat()
        res = await autenticado.get(f"/api/v1/dashboard/resumo?inicio={hoje}&fim={hoje}")
        assert res.status_code == 200
        dados = res.json()
        assert "financeiro" in dados
        assert "operacional" in dados
        assert "graficos" in dados
        assert "alertas" in dados
        assert "orcamentos_pendentes" in dados["operacional"]
