"""Unit — serviço de assinatura (enforcement lazy de acesso)."""

from datetime import UTC, datetime, timedelta

from app.models.saas import Assinatura, StatusAssinatura
from app.services.assinatura import (
    CARENCIA_DIAS,
    acesso_liberado,
    motivo_bloqueio,
    periodo_para_ciclo,
)

AGORA = datetime.now(UTC)


def _ass(**kw) -> Assinatura:
    return Assinatura(**kw)


class TestPeriodoParaCiclo:
    def test_mensal_recorrente_nao_tem_fim(self):
        inicio, fim = periodo_para_ciclo("mensal", AGORA)
        assert inicio == AGORA
        assert fim is None

    def test_trimestral_soma_3_meses_e_carencia(self):
        base = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)
        _, fim = periodo_para_ciclo("trimestral", base)
        assert fim == datetime(2026, 4, 15, 12, 0, tzinfo=UTC) + timedelta(days=CARENCIA_DIAS)

    def test_semestral_e_anual(self):
        base = datetime(2026, 1, 15, tzinfo=UTC)
        assert periodo_para_ciclo("semestral", base)[1] == datetime(
            2026, 7, 15, tzinfo=UTC
        ) + timedelta(days=CARENCIA_DIAS)
        assert periodo_para_ciclo("anual", base)[1] == datetime(
            2027, 1, 15, tzinfo=UTC
        ) + timedelta(days=CARENCIA_DIAS)

    def test_ajusta_fim_de_mes(self):
        # 30/nov + 3 meses → fevereiro não tem dia 30 → 28/fev (+ carência).
        base = datetime(2026, 11, 30, tzinfo=UTC)
        _, fim = periodo_para_ciclo("trimestral", base)
        assert fim == datetime(2027, 2, 28, tzinfo=UTC) + timedelta(days=CARENCIA_DIAS)

    def test_ciclo_desconhecido_fica_sem_fim(self):
        assert periodo_para_ciclo(None)[1] is None
        assert periodo_para_ciclo("quinzenal")[1] is None


class TestAcessoLiberado:
    def test_sem_assinatura_bloqueia(self):
        assert acesso_liberado(None) is False
        assert motivo_bloqueio(None) == "sem_assinatura"

    def test_trial_vigente_libera(self):
        a = _ass(status=StatusAssinatura.TRIAL, trial_expira_em=AGORA + timedelta(days=5))
        assert acesso_liberado(a) is True
        assert motivo_bloqueio(a) is None

    def test_trial_expirado_bloqueia(self):
        a = _ass(status=StatusAssinatura.TRIAL, trial_expira_em=AGORA - timedelta(days=1))
        assert acesso_liberado(a) is False
        assert motivo_bloqueio(a) == "trial_expirado"

    def test_ativa_sem_periodo_fim_libera(self):
        a = _ass(status=StatusAssinatura.ATIVA, periodo_fim=None)
        assert acesso_liberado(a) is True
        assert motivo_bloqueio(a) is None

    def test_ativa_com_periodo_vigente_libera(self):
        a = _ass(status=StatusAssinatura.ATIVA, periodo_fim=AGORA + timedelta(days=30))
        assert acesso_liberado(a) is True

    def test_ativa_com_periodo_passado_bloqueia(self):
        a = _ass(status=StatusAssinatura.ATIVA, periodo_fim=AGORA - timedelta(days=1))
        assert acesso_liberado(a) is False
        assert motivo_bloqueio(a) == "assinatura_expirada"

    def test_suspensa_cancelada_inadimplente_bloqueiam(self):
        casos = {
            StatusAssinatura.SUSPENSA: "suspensa",
            StatusAssinatura.CANCELADA: "cancelada",
            StatusAssinatura.INADIMPLENTE: "inadimplente",
        }
        for status_, motivo in casos.items():
            a = _ass(status=status_)
            assert acesso_liberado(a) is False
            assert motivo_bloqueio(a) == motivo
