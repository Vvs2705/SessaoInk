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
from app.models.atendimento import Atendimento
from app.models.cliente import Cliente
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso, TipoDocumento
from app.models.usuario import Usuario
from app.services.audit import log_event

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
    # Validar se o cliente pertence ao mesmo estúdio do usuário
    if dados.cliente_id:
        cliente_exists = await session.scalar(
            select(Cliente).where(
                Cliente.id == dados.cliente_id,
                Cliente.estudio_id == usuario.estudio_id,
                Cliente.ativo,
            )
        )
        if not cliente_exists:
            raise HTTPException(
                status_code=400,
                detail="Cliente inválido ou não pertence ao seu estúdio",
            )

    # Validar se o atendimento pertence ao mesmo estúdio do usuário
    if dados.atendimento_id:
        atendimento_exists = await session.scalar(
            select(Atendimento).where(
                Atendimento.id == dados.atendimento_id,
                Atendimento.estudio_id == usuario.estudio_id,
                Atendimento.ativo,
            )
        )
        if not atendimento_exists:
            raise HTTPException(
                status_code=400,
                detail="Atendimento inválido ou não pertence ao seu estúdio",
            )

    doc = Documento(
        estudio_id=usuario.estudio_id,
        **dados.model_dump(),
    )
    session.add(doc)
    await session.flush()
    await session.refresh(doc)
    return doc


@router.get("/{id}", response_model=DocumentoResponse)
async def obter_documento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Documento).where(
            Documento.id == id,
            Documento.estudio_id == usuario.estudio_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Documento não encontrado")
    return doc


@router.delete("/{id}", status_code=204)
async def deletar_documento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Remove o documento permanentemente (documentos não têm soft delete — são dados LGPD controláveis)."""
    result = await session.execute(
        select(Documento).where(
            Documento.id == id,
            Documento.estudio_id == usuario.estudio_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Documento não encontrado")
    await session.delete(doc)
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
    doc = await session.scalar(
        select(Documento).where(
            Documento.id == id, Documento.estudio_id == usuario.estudio_id
        )
    )
    if not doc:
        raise HTTPException(404, "Documento não encontrado")

    token_raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_raw.encode()).hexdigest()
    expira = datetime.now(UTC) + timedelta(hours=max(1, min(horas, 720)))

    link = DocumentoLinkAcesso(
        documento_id=id,
        token_hash=token_hash,
        acao=acao,
        expira_em=expira,
    )
    session.add(link)
    await session.flush()

    # P0-05/P0-10 — auditoria de geração de link (IP/UA do servidor capturados)
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

    # Retorna SOMENTE a URL final (P0-05) — nunca o token em campo separado.
    url = f"{settings.APP_URL}/documento/{token_raw}"
    return {"url": url, "expira_em": expira.isoformat(), "acao": acao}
