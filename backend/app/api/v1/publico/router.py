"""Router do Portal Público — sem autenticação."""

from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.config import settings
from app.core.database import get_session
from app.models.usuario import Estudio
from app.models.atendimento import Atendimento, AtendimentoImagem, StatusOperacional, TipoAtendimento
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


class PortfolioPublicoItem(BaseModel):
    id: str
    titulo: Optional[str]
    descricao: Optional[str]
    estilo: Optional[str]
    parte_corpo: Optional[str]
    imagem_path: str
    model_config = {"from_attributes": True}


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


@router.get("/{slug}/portfolio", response_model=list[PortfolioPublicoItem])
async def portfolio_publico(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Retorna itens do portfólio com visibilidade PUBLICO e autorização — sem autenticação."""
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    items_result = await session.execute(
        select(Portfolio)
        .where(
            Portfolio.estudio_id == estudio.id,
            Portfolio.visibilidade == VisibilidadePortfolio.PUBLICO,
            Portfolio.autorizado_publicacao == True,
            Portfolio.ativo == True,
        )
        .order_by(Portfolio.criado_em.desc())
        .limit(30)
    )
    return [
        PortfolioPublicoItem(
            id=str(p.id),
            titulo=p.titulo,
            descricao=p.descricao,
            estilo=p.estilo,
            parte_corpo=p.parte_corpo,
            imagem_path=p.imagem_path,
        )
        for p in items_result.scalars().all()
    ]


@router.get("/{slug}/portfolio/{portfolio_id}/imagem")
async def imagem_portfolio_publico(
    slug: str,
    portfolio_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Serve a imagem pública do portfólio sem autenticação."""
    import uuid as _uuid

    try:
        pid = _uuid.UUID(portfolio_id)
    except ValueError:
        raise HTTPException(400, "ID inválido")

    result_estudio = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result_estudio.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == pid,
            Portfolio.estudio_id == estudio.id,
            Portfolio.visibilidade == VisibilidadePortfolio.PUBLICO,
            Portfolio.autorizado_publicacao == True,
            Portfolio.ativo == True,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Imagem não encontrada")

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(item.estudio_id)
        / "portfolio"
        / item.imagem_path
    )
    if not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado")

    return FileResponse(str(caminho))


@router.post("/{slug}/orcamento", response_model=OrcamentoResponse, status_code=201)
async def solicitar_orcamento(
    slug: str,
    nome: str = Form(...),
    whatsapp: str = Form(...),
    instagram: Optional[str] = Form(None),
    descricao: Optional[str] = Form(None),
    estilo: Optional[str] = Form(None),
    parte_corpo: Optional[str] = Form(None),
    tamanho_cm: Optional[str] = Form(None),
    observacoes: Optional[str] = Form(None),
    aceite_privacidade: bool = Form(...),
    aceite_termos: bool = Form(...),
    imagens: Optional[list[UploadFile]] = File(None),
    session: AsyncSession = Depends(get_session),
):
    if not aceite_privacidade or not aceite_termos:
        raise HTTPException(400, "É necessário aceitar a política de privacidade e os termos de uso")

    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    # Construir notas_privadas
    notas = f"Contato: {nome} | WhatsApp: {whatsapp}"
    if instagram:
        notas += f" | Instagram: {instagram}"
    if observacoes:
        notas += f"\nObservações: {observacoes}"

    # Criar atendimento automaticamente
    atendimento = Atendimento(
        estudio_id=estudio.id,
        status_operacional=StatusOperacional.SOLICITADO,
        tipo=TipoAtendimento.TATUAGEM,
        descricao=descricao,
        parte_corpo=parte_corpo,
        estilo=estilo,
        tamanho_cm=tamanho_cm,
        notas_privadas=notas,
    )
    session.add(atendimento)
    await session.flush()

    # Salvar imagens fisicamente se houver
    import uuid
    if imagens:
        upload_dir = Path(settings.STORAGE_PATH) / "uploads" / str(estudio.id) / "atendimentos" / str(atendimento.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        for imagem in imagens:
            # Pula arquivos se forem enviados vazios ou sem nome
            if not imagem.filename:
                continue
            
            # Gerar nome de arquivo único
            ext = Path(imagem.filename).suffix
            novo_nome = f"{uuid.uuid4()}{ext}"
            caminho_arquivo = upload_dir / novo_nome
            
            # Salvar o arquivo de forma assíncrona
            conteudo = await imagem.read()
            with open(caminho_arquivo, "wb") as f:
                f.write(conteudo)
            
            # Registrar no banco de dados
            atendimento_imagem = AtendimentoImagem(
                atendimento_id=atendimento.id,
                imagem_path=novo_nome
            )
            session.add(atendimento_imagem)
        
        await session.flush()

    protocolo = f"SI{str(atendimento.id).split('-')[0].upper()}"

    return OrcamentoResponse(
        protocolo=protocolo,
        atendimento_id=str(atendimento.id),
        mensagem="Pedido de orçamento recebido com sucesso! Entraremos em contato em breve.",
    )
