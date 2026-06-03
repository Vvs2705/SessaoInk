"""Serviço de Assinatura — ciclo de vida (trial → ativa) e plano efetivo.

Fonte do enforcement de entitlements: o `plano_slug` efetivo de um estúdio
decide quais recursos ele acessa (catálogo em app/core/planos.py).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.planos import TRIAL_DIAS, get_plano
from app.models.saas import Assinatura, StatusAssinatura

# Tier oferecido durante o trial (alvo de conversão).
PLANO_TRIAL = "profissional"


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


def trial_expirado(assinatura: Assinatura) -> bool:
    if assinatura.status != StatusAssinatura.TRIAL:
        return False
    if assinatura.trial_expira_em is None:
        return False
    return datetime.now(UTC) >= _utc(assinatura.trial_expira_em)


def acesso_liberado(assinatura: Assinatura | None) -> bool:
    """True se o estúdio pode usar os recursos pagos (trial válido ou ativa)."""
    if assinatura is None:
        return False
    if assinatura.status == StatusAssinatura.ATIVA:
        return True
    if assinatura.status == StatusAssinatura.TRIAL:
        return not trial_expirado(assinatura)
    return False


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
        "precisa_assinar": not liberado,
    }
