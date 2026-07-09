"""Router de Documentos e Termos."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.config import settings
from app.core.database import get_session
from app.core.request_context import get_client_ip, get_user_agent
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso, TipoDocumento
from app.models.usuario import Estudio, Usuario
from app.services.audit import log_event
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_cliente_do_estudio,
    get_documento_do_estudio,
)

router = APIRouter(prefix="/documentos", tags=["documentos"])


class DocumentoCreate(BaseModel):
    tipo: TipoDocumento
    titulo: str
    conteudo: str | None = None
    versao: str = "1.0"
    cliente_id: uuid.UUID | None = None
    atendimento_id: uuid.UUID | None = None


class DocumentoResponse(BaseModel):
    id: uuid.UUID
    tipo: TipoDocumento
    titulo: str
    conteudo: str | None
    versao: str
    assinado: bool
    data_assinatura: datetime | None
    cliente_id: uuid.UUID | None
    atendimento_id: uuid.UUID | None
    criado_em: datetime
    model_config = {"from_attributes": True}


@router.get("/", response_model=list[DocumentoResponse])
async def listar_documentos(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Documento)
        .where(Documento.estudio_id == usuario.estudio_id)
        .order_by(Documento.criado_em.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=DocumentoResponse, status_code=201)
async def criar_documento(
    dados: DocumentoCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    if dados.cliente_id:
        await get_cliente_do_estudio(
            session,
            cliente_id=dados.cliente_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=400,
            detail="Cliente inválido ou não pertence ao seu estúdio",
        )

    if dados.atendimento_id:
        await get_atendimento_do_estudio(
            session,
            atendimento_id=dados.atendimento_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=400,
            detail="Atendimento inválido ou não pertence ao seu estúdio",
        )

    doc = Documento(
        estudio_id=usuario.estudio_id,
        **dados.model_dump(),
    )
    session.add(doc)
    await session.flush()
    await session.refresh(doc)
    await log_event(
        session,
        acao="documento.created",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="documento",
        entidade_id=str(doc.id),
        dados={"tipo": doc.tipo.value, "versao": doc.versao},
    )
    return doc


@router.get("/{id}", response_model=DocumentoResponse)
async def obter_documento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    return await get_documento_do_estudio(
        session,
        documento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Documento não encontrado",
    )


@router.delete("/{id}", status_code=204)
async def deletar_documento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Remove o documento permanentemente."""
    doc = await get_documento_do_estudio(
        session,
        documento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Documento não encontrado",
    )
    doc_id = str(doc.id)
    doc_tipo = doc.tipo.value
    await session.delete(doc)
    await log_event(
        session,
        acao="documento.deleted",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="documento",
        entidade_id=doc_id,
        dados={"tipo": doc_tipo},
    )
    return None


@router.post("/{id}/gerar-link", response_model=dict)
async def gerar_link_documento(
    id: uuid.UUID,
    request: Request,
    acao: AcaoLink = AcaoLink.ASSINAR,
    horas: int = 72,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Gera link seguro de acesso ao documento para compartilhar com cliente."""
    await get_documento_do_estudio(
        session,
        documento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Documento não encontrado",
    )

    estudio = await session.get(Estudio, usuario.estudio_id)
    if estudio is None:  # pragma: no cover — FK garante estúdio do usuário autenticado
        raise HTTPException(404, "Estúdio não encontrado")

    token_raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_raw.encode()).hexdigest()
    expira = datetime.now(UTC) + timedelta(hours=max(1, min(horas, 720)))

    link = DocumentoLinkAcesso(
        documento_id=id,
        token_hash=token_hash,
        acao=acao,
        expira_em=expira,
        ip_geracao=get_client_ip(request),
    )
    session.add(link)
    await session.flush()

    await log_event(
        session,
        acao="documento.link_generated",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="documento",
        entidade_id=str(id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        dados={"acao_link": acao.value, "expira_em": expira.isoformat()},
    )

    # URL pública casada com a rota do frontend: /{slug}/documento/{token}
    url = f"{settings.APP_URL}/{estudio.slug}/documento/{token_raw}"
    return {"url": url, "expira_em": expira.isoformat(), "acao": acao}
