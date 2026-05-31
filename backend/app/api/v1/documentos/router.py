"""Router de Documentos e Termos."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.config import settings
from app.core.database import get_session
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso, TipoDocumento
from app.models.usuario import Usuario
from app.models.cliente import Cliente
from app.models.atendimento import Atendimento

router = APIRouter(prefix="/documentos", tags=["documentos"])


class DocumentoCreate(BaseModel):
    tipo: TipoDocumento
    titulo: str
    conteudo: Optional[str] = None
    versao: str = "1.0"
    cliente_id: Optional[uuid.UUID] = None
    atendimento_id: Optional[uuid.UUID] = None


class DocumentoResponse(BaseModel):
    id: uuid.UUID
    tipo: TipoDocumento
    titulo: str
    conteudo: Optional[str]
    versao: str
    assinado: bool
    data_assinatura: Optional[datetime]
    cliente_id: Optional[uuid.UUID]
    atendimento_id: Optional[uuid.UUID]
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
                Cliente.ativo == True,
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
                Atendimento.ativo == True,
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
    expira = datetime.now(timezone.utc) + timedelta(hours=max(1, min(horas, 720)))

    link = DocumentoLinkAcesso(
        documento_id=id,
        token_hash=token_hash,
        acao=acao,
        expira_em=expira,
    )
    session.add(link)
    await session.flush()

    url = f"{settings.APP_URL}/documento/{token_raw}"
    return {"url": url, "token": token_raw, "expira_em": expira.isoformat(), "acao": acao}
