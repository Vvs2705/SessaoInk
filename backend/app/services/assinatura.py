"""Serviço de Assinatura — ciclo de vida (trial → ativa) e plano efetivo.

Fonte do enforcement de entitlements: o `plano_slug` efetivo de um estúdio
decide quais recursos ele acessa (catálogo em app/core/planos.py).
"""

from __future__ import annotations

import calendar
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.planos import TRIAL_DIAS, get_plano
from app.models.saas import Assinatura, StatusAssinatura

# Tier oferecido durante o trial (alvo de conversão).
PLANO_TRIAL = "profissional"

# Carência após o fim do período pago (evita bloquear no exato dia da renovação).
CARENCIA_DIAS = 3

# Meses cobertos por cada ciclo avulso (mensal é recorrente via preapproval).
_CICLO_MESES = {"trimestral": 3, "semestral": 6, "anual": 12}


async def get_assinatura(
    session: AsyncSession, estudio_id: uuid.UUID
) -> Assinatura | None:
    return await session.scalar(
        select(Assinatura).where(Assinatura.estudio_id == estudio_id)
    )


async def criar_trial(
    session: AsyncSession,
    estudio_id: uuid.UUID,
    *,
    plano_slug: str = PLANO_TRIAL,
    dias: int = TRIAL_DIAS,
) -> Assinatura:
    """Cria (idempotente) a assinatura TRIAL de um estúdio recém-criado."""
    existente = await get_assinatura(session, estudio_id)
    if existente is not None:
        return existente
    assinatura = Assinatura(
        estudio_id=estudio_id,
        status=StatusAssinatura.TRIAL,
        plano_slug=plano_slug,
        trial_expira_em=datetime.now(UTC) + timedelta(days=dias),
    )
    session.add(assinatura)
    await session.flush()
    return assinatura


def _utc(dt: datetime) -> datetime:
    """Normaliza para UTC-aware (o SQLite devolve datetime naive)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _somar_meses(dt: datetime, meses: int) -> datetime:
    """Soma meses de calendário, ajustando o dia ao fim do mês quando preciso."""
    total = dt.month - 1 + meses
    ano, mes = dt.year + total // 12, total % 12 + 1
    dia = min(dt.day, calendar.monthrange(ano, mes)[1])
    return dt.replace(year=ano, month=mes, day=dia)


def periodo_para_ciclo(
    ciclo: str | None, inicio: datetime | None = None
) -> tuple[datetime, datetime | None]:
    """(periodo_inicio, periodo_fim) a gravar na ativação de uma cobrança.

    - Mensal (preapproval recorrente): periodo_fim=None — o Mercado Pago pausa o
      preapproval na falha de renovação e o webhook suspende a assinatura.
    - Avulso (trimestral/semestral/anual): fim = início + N meses + carência.
    """
    inicio = inicio or datetime.now(UTC)
    meses = _CICLO_MESES.get(ciclo or "")
    if meses is None:
        return inicio, None
    return inicio, _somar_meses(inicio, meses) + timedelta(days=CARENCIA_DIAS)


def trial_expirado(assinatura: Assinatura) -> bool:
    if assinatura.status != StatusAssinatura.TRIAL:
        return False
    if assinatura.trial_expira_em is None:
        return False
    return datetime.now(UTC) >= _utc(assinatura.trial_expira_em)


def assinatura_expirada(assinatura: Assinatura) -> bool:
    """ATIVA cujo período pago (avulso) já terminou — expiração lazy, sem cron."""
    if assinatura.status != StatusAssinatura.ATIVA or assinatura.periodo_fim is None:
        return False
    return datetime.now(UTC) >= _utc(assinatura.periodo_fim)


def acesso_liberado(assinatura: Assinatura | None) -> bool:
    """True se o estúdio pode usar os recursos pagos (trial válido ou ativa vigente)."""
    if assinatura is None:
        return False
    if assinatura.status == StatusAssinatura.ATIVA:
        return not assinatura_expirada(assinatura)
    if assinatura.status == StatusAssinatura.TRIAL:
        return not trial_expirado(assinatura)
    return False


def motivo_bloqueio(assinatura: Assinatura | None) -> str | None:
    """Slug do motivo do bloqueio (para o 402 do frontend); None se liberado."""
    if acesso_liberado(assinatura):
        return None
    if assinatura is None:
        return "sem_assinatura"
    match assinatura.status:
        case StatusAssinatura.TRIAL:
            return "trial_expirado"
        case StatusAssinatura.ATIVA:
            return "assinatura_expirada"
        case StatusAssinatura.CANCELADA:
            return "cancelada"
        case StatusAssinatura.INADIMPLENTE:
            return "inadimplente"
        case _:
            return "suspensa"


def plano_efetivo(assinatura: Assinatura | None) -> str | None:
    """Slug do plano que vale para entitlements; None se acesso bloqueado."""
    if not acesso_liberado(assinatura):
        return None
    return (assinatura.plano_slug if assinatura else None) or PLANO_TRIAL


def dias_restantes_trial(assinatura: Assinatura) -> int | None:
    if assinatura.status != StatusAssinatura.TRIAL or assinatura.trial_expira_em is None:
        return None
    delta = _utc(assinatura.trial_expira_em) - datetime.now(UTC)
    return max(0, delta.days)


def resumo(assinatura: Assinatura | None) -> dict[str, Any]:
    """Resumo da assinatura para o frontend (status, plano, trial, CTA)."""
    if assinatura is None:
        return {
            "status": "SEM_ASSINATURA",
            "plano_slug": None,
            "plano_nome": None,
            "acesso_liberado": False,
            "trial": False,
            "dias_restantes_trial": None,
            "precisa_assinar": True,
            "motivo_bloqueio": "sem_assinatura",
        }
    slug = assinatura.plano_slug
    plano = get_plano(slug) if slug else None
    liberado = acesso_liberado(assinatura)
    em_trial = assinatura.status == StatusAssinatura.TRIAL and not trial_expirado(assinatura)
    return {
        "status": assinatura.status.value,
        "plano_slug": slug,
        "plano_nome": plano["nome"] if plano else None,
        "ciclo": assinatura.ciclo,
        "acesso_liberado": liberado,
        "trial": em_trial,
        "dias_restantes_trial": dias_restantes_trial(assinatura),
        "trial_expira_em": (
            assinatura.trial_expira_em.isoformat()
            if assinatura.trial_expira_em
            else None
        ),
        "periodo_fim": (
            assinatura.periodo_fim.isoformat() if assinatura.periodo_fim else None
        ),
        "precisa_assinar": not liberado,
        "motivo_bloqueio": motivo_bloqueio(assinatura),
    }
