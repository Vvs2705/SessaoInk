"""Router do Portal Público — sem autenticação."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_session
from app.models.usuario import Estudio
from app.models.atendimento import Atendimento, StatusOperacional, TipoAtendimento
from app.models.portfolio import Portfolio, VisibilidadePortfolio, FlashArt, StatusFlash

router = APIRouter(prefix="/public", tags=["portal-público"])


class EstudioPublicoResponse(BaseModel):
    slug: str
    nome: str
    bio: Optional[str]
    cidade: Optional[str]
    uf: Optional[str]
    instagram: Optional[str]
    model_config = {"from_attributes": True}


class OrcamentoRequest(BaseModel):
    nome: str
    whatsapp: str
    instagram: Optional[str] = None
    descricao: Optional[str] = None
    estilo: Optional[str] = None
    parte_corpo: Optional[str] = None
    tamanho_cm: Optional[str] = None
    observacoes: Optional[str] = None
    aceite_privacidade: bool
    aceite_termos: bool


class OrcamentoResponse(BaseModel):
    protocolo: str
    atendimento_id: str
    mensagem: str


@router.get("/{slug}", response_model=EstudioPublicoResponse)
async def perfil_publico(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")
    return estudio


@router.post("/{slug}/orcamento", response_model=OrcamentoResponse, status_code=201)
async def solicitar_orcamento(
    slug: str,
    dados: OrcamentoRequest,
    session: AsyncSession = Depends(get_session),
):
    if not dados.aceite_privacidade or not dados.aceite_termos:
        raise HTTPException(400, "É necessário aceitar a política de privacidade e os termos de uso")

    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    # Criar atendimento automaticamente
    atendimento = Atendimento(
        estudio_id=estudio.id,
        status_operacional=StatusOperacional.SOLICITADO,
        tipo=TipoAtendimento.TATUAGEM,
        descricao=dados.descricao,
        parte_corpo=dados.parte_corpo,
        estilo=dados.estilo,
        tamanho_cm=dados.tamanho_cm,
        notas_privadas=f"Contato: {dados.nome} | WhatsApp: {dados.whatsapp}{f' | Instagram: {dados.instagram}' if dados.instagram else ''}",
    )
    session.add(atendimento)
    await session.flush()

    import uuid
    protocolo = f"SI{str(atendimento.id).split('-')[0].upper()}"

    return OrcamentoResponse(
        protocolo=protocolo,
        atendimento_id=str(atendimento.id),
        mensagem="Pedido de orçamento recebido com sucesso! Entraremos em contato em breve.",
    )
