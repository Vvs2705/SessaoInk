"""P0-10 — Endpoint administrativo de consulta de auditoria."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import require_role
from app.core.database import get_session
from app.models.audit_log import AuditLog
from app.models.usuario import TipoUsuario, Usuario

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    acao: str
    actor_usuario_id: uuid.UUID | None
    actor_tipo: str | None
    entidade: str | None
    entidade_id: str | None
    ip: str | None
    created_em: datetime
    dados: dict | None
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[AuditLogResponse])
async def listar_auditoria(
    acao: str | None = Query(None, description="Filtra por ação exata"),
    limite: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Lista eventos de auditoria do PRÓPRIO estúdio (ADMIN). Paginado, mais recentes primeiro.

    Isolamento de tenant: a consulta é sempre restrita ao estudio_id do ADMIN
    autenticado — nunca expõe auditoria de outro estúdio.
    """
    stmt = (
        select(AuditLog)
        .where(AuditLog.estudio_id == usuario.estudio_id)
        .order_by(AuditLog.created_em.desc())
        .limit(limite)
        .offset(offset)
    )
    if acao:
        stmt = stmt.where(AuditLog.acao == acao)

    result = await session.execute(stmt)
    return result.scalars().all()
