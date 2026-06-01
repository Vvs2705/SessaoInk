"""Endpoints administrativos operacionais."""

import secrets
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from fastapi import (
    APIRouter,
    Body,
    Cookie,
    Depends,
    Header,
    HTTPException,
    Request,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.request_context import get_client_ip, get_user_agent
from app.core.security import decodificar_token
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


@dataclass(frozen=True)
class LGPDActor:
    estudio_id: UUID | None
    usuario_id: UUID | None
    tipo: str


def _validar_bearer_servico(authorization: str | None) -> bool:
    if not settings.LGPD_RETENTION_TOKEN or not authorization:
        return False
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    try:
        token_bytes = token.encode("ascii")
        esperado_bytes = settings.LGPD_RETENTION_TOKEN.encode("ascii")
    except UnicodeEncodeError:
        return False
    return secrets.compare_digest(token_bytes, esperado_bytes)


async def require_admin_or_lgpd_service(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> LGPDActor:
    if _validar_bearer_servico(authorization):
        return LGPDActor(estudio_id=None, usuario_id=None, tipo="service")

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="NÃ£o autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not access_token:
        raise credentials_exception

    try:
        payload = decodificar_token(access_token)
        usuario_id = UUID(str(payload.get("sub")))
    except (TypeError, ValueError, AttributeError):
        raise credentials_exception

    usuario = await session.scalar(
        select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.ativo,
        )
    )
    if not usuario:
        raise credentials_exception
    if usuario.tipo != TipoUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PermissÃ£o insuficiente para esta operaÃ§Ã£o.",
        )

    return LGPDActor(
        estudio_id=usuario.estudio_id,
        usuario_id=usuario.id,
        tipo=usuario.tipo.value,
    )


@router.post("/lgpd/anonimizar", response_model=AnonimizacaoLGPDResponse)
async def anonimizar_lgpd_expirada(
    request: Request,
    payload: AnonimizacaoLGPDRequest = Body(default_factory=AnonimizacaoLGPDRequest),
    session: AsyncSession = Depends(get_session),
    actor: LGPDActor = Depends(require_admin_or_lgpd_service),
) -> AnonimizacaoLGPDResponse:
    """Executa retencao LGPD de orcamentos publicos expirados do estudio."""
    resultado = await anonimizar_orcamentos_publicos_expirados(
        session,
        agora=payload.agora,
        estudio_id=actor.estudio_id,
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
        estudio_id=actor.estudio_id,
        actor_usuario_id=actor.usuario_id,
        actor_tipo=actor.tipo,
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
