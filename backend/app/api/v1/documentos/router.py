"""Router de Documentos e Termos."""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.documento import Documento, TipoDocumento
from app.models.usuario import Usuario

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
