"""Testes do gatilho administrativo de retenção LGPD."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session
from app.models.atendimento import Atendimento, StatusOperacional, TipoAtendimento
from app.models.audit_log import AuditLog
from app.models.usuario import Usuario


class TestAdminLGPD:
    async def test_endpoint_admin_anonimiza_e_audita_orcamentos_expirados(
        self,
        autenticado,
    ):
        agora = datetime(2026, 6, 1, tzinfo=UTC)

        async with async_session() as session:
            admin = await session.scalar(
                select(Usuario).where(Usuario.email == "admin@sessaoink.dev")
            )
            assert admin is not None

            atendimento = Atendimento(
                estudio_id=admin.estudio_id,
                status_operacional=StatusOperacional.SOLICITADO,
                tipo=TipoAtendimento.TATUAGEM,
                descricao="Dado pessoal em orçamento antigo",
                notas_privadas="Contato: Pessoa LGPD | WhatsApp: 11999999999",
                orcamento_publico=True,
                lgpd_retencao_ate=agora - timedelta(days=1),
            )
            session.add(atendimento)
            await session.commit()
            atendimento_id = atendimento.id

        r = await autenticado.post(
            "/api/v1/admin/lgpd/anonimizar",
            json={"agora": agora.isoformat()},
        )

        assert r.status_code == 200, r.text
        assert r.json()["candidatos"] >= 1
        assert r.json()["anonimizados"] >= 1
        assert r.json()["dry_run"] is False

        async with async_session() as session:
            atendimento = await session.get(Atendimento, atendimento_id)
            logs = (
                await session.scalars(
                select(AuditLog)
                .where(AuditLog.acao == "lgpd.anonymized")
                .order_by(AuditLog.created_em.desc())
                )
            )
            log = next(
                (
                    item for item in logs
                    if item.dados is not None and item.dados.get("anonimizados", 0) >= 1
                ),
                None,
            )

            assert atendimento is not None
            assert atendimento.lgpd_anonimizado_em is not None
            assert atendimento.notas_privadas == "[anonimizado LGPD]"
            assert atendimento.descricao is None
            assert log is not None
            assert log.dados is not None
            assert log.dados["anonimizados"] >= 1

    async def test_endpoint_lgpd_e_admin_only(self, client):
        r = await client.post("/api/v1/admin/lgpd/anonimizar", json={})

        assert r.status_code == 401

    async def test_endpoint_lgpd_aceita_token_de_servico(self, client, monkeypatch):
        monkeypatch.setattr("app.api.v1.admin.router.settings.LGPD_RETENTION_TOKEN", "token-lgpd-service-1234567890")

        r = await client.post(
            "/api/v1/admin/lgpd/anonimizar",
            headers={"Authorization": "Bearer token-lgpd-service-1234567890"},
            json={"dry_run": True},
        )

        assert r.status_code == 200, r.text
        assert r.json()["dry_run"] is True

    async def test_endpoint_lgpd_dry_run_nao_altera_dados(self, autenticado):
        agora = datetime(2026, 6, 1, tzinfo=UTC)

        async with async_session() as session:
            admin = await session.scalar(
                select(Usuario).where(Usuario.email == "admin@sessaoink.dev")
            )
            assert admin is not None

            atendimento = Atendimento(
                estudio_id=admin.estudio_id,
                status_operacional=StatusOperacional.SOLICITADO,
                tipo=TipoAtendimento.TATUAGEM,
                descricao="Dado que deve permanecer no dry-run",
                notas_privadas="Contato dry-run",
                orcamento_publico=True,
                lgpd_retencao_ate=agora - timedelta(days=1),
            )
            session.add(atendimento)
            await session.commit()
            atendimento_id = atendimento.id

        r = await autenticado.post(
            "/api/v1/admin/lgpd/anonimizar",
            json={"agora": agora.isoformat(), "dry_run": True},
        )

        assert r.status_code == 200, r.text
        assert r.json()["candidatos"] >= 1
        assert r.json()["anonimizados"] == 0

        async with async_session() as session:
            atendimento = await session.get(Atendimento, atendimento_id)
            assert atendimento is not None
            assert atendimento.lgpd_anonimizado_em is None
            assert atendimento.descricao == "Dado que deve permanecer no dry-run"
