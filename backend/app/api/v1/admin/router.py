"""Endpoints administrativos operacionais."""

from datetime import datetime

from fastapi import APIRouter, Body, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import require_role
from app.core.database import get_session
from app.core.request_context import get_client_ip, get_user_agent
from app.models.usuario import TipoUsuario, Usuario
from app.services.audit import log_event
from app.services.lgpd import anonimizar_orcamentos_publicos_expirados

router = APIRouter(prefix="/admin", tags=["admin"])


class AnonimizacaoLGPDResponse(BaseModel):
    candidatos: int
    anonimizados: int
    dry_run: bool


class AnonimizacaoLGPDRequest(BaseModel):
    dry_run: bool = False
    limite: int | None = Field(default=None, ge=1, le=1000)
    agora: datetime | None = None


@router.post("/lgpd/anonimizar", response_model=AnonimizacaoLGPDResponse)
async def anonimizar_lgpd_expirada(
    request: Request,
    payload: AnonimizacaoLGPDRequest = Body(default_factory=AnonimizacaoLGPDRequest),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
) -> AnonimizacaoLGPDResponse:
    """Executa retencao LGPD de orcamentos publicos expirados do estudio."""
    resultado = await anonimizar_orcamentos_publicos_expirados(
        session,
        agora=payload.agora,
        estudio_id=usuario.estudio_id,
        limite=payload.limite,
        dry_run=payload.dry_run,
    )
    dados = {
        "candidatos": resultado.candidatos,
        "anonimizados": resultado.anonimizados,
        "dry_run": payload.dry_run,
        "limite": payload.limite,
    }

    await log_event(
        session,
        acao="lgpd.anonymized",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="atendimento",
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        dados=dados,
    )

    return AnonimizacaoLGPDResponse(
        candidatos=resultado.candidatos,
        anonimizados=resultado.anonimizados,
        dry_run=payload.dry_run,
    )
