"""Router do Portal Público — sem autenticação."""

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

import uuid
from app.core.config import settings
from app.core.database import get_session
from app.core.redis import verificar_limite_orcamento, registrar_solicitacao_orcamento
from app.models.usuario import Estudio
from app.models.atendimento import Atendimento, AtendimentoImagem, StatusOperacional, TipoAtendimento
from app.models.portfolio import Portfolio, VisibilidadePortfolio, FlashArt, StatusFlash
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso

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


class FlashArtPublicaResponse(BaseModel):
    id: str
    titulo: str
    descricao: Optional[str]
    preco: Optional[float]
    tamanho_sugerido: Optional[str]
    local_recomendado: Optional[str]
    has_imagem: bool


@router.get("/{slug}/flash-arts", response_model=list[FlashArtPublicaResponse])
async def flash_arts_publicas(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Retorna flash arts disponíveis do estúdio — sem autenticação."""
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result_flash = await session.execute(
        select(FlashArt).where(
            FlashArt.estudio_id == estudio.id,
            FlashArt.status == StatusFlash.DISPONIVEL,
            FlashArt.ativo == True,
        ).order_by(FlashArt.criado_em.desc())
    )
    return [
        FlashArtPublicaResponse(
            id=str(f.id),
            titulo=f.titulo,
            descricao=f.descricao,
            preco=float(f.preco) if f.preco else None,
            tamanho_sugerido=f.tamanho_sugerido,
            local_recomendado=f.local_recomendado,
            has_imagem=bool(f.imagem_path),
        )
        for f in result_flash.scalars().all()
    ]


@router.get("/{slug}/flash-arts/{flash_id}/imagem")
async def imagem_flash_art_publica(
    slug: str,
    flash_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Serve imagem pública de flash art — sem autenticação."""
    import uuid as _uuid
    try:
        fid = _uuid.UUID(flash_id)
    except ValueError:
        raise HTTPException(400, "ID inválido")

    result_estudio = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo == True)
    )
    estudio = result_estudio.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result = await session.execute(
        select(FlashArt).where(
            FlashArt.id == fid,
            FlashArt.estudio_id == estudio.id,
            FlashArt.status == StatusFlash.DISPONIVEL,
            FlashArt.ativo == True,
        )
    )
    flash = result.scalar_one_or_none()
    if not flash:
        raise HTTPException(404, "Flash art não encontrada")

    if not flash.imagem_path:
        raise HTTPException(404, "Imagem não disponível")

    caminho = (
        Path(settings.STORAGE_PATH)
        / "uploads"
        / str(flash.estudio_id)
        / "flash_arts"
        / flash.imagem_path
    )
    if not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado")

    return FileResponse(str(caminho))


@router.post("/{slug}/orcamento", response_model=OrcamentoResponse, status_code=201)
async def solicitar_orcamento(
    slug: str,
    request: Request,
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
    email_confirm: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    imagens: Optional[list[UploadFile]] = File(None),
    session: AsyncSession = Depends(get_session),
):
    # 1. Rate Limiting
    ip = request.client.host if request.client else "unknown"
    if await verificar_limite_orcamento(ip):
        raise HTTPException(
            status_code=429,
            detail="Muitas solicitações de orçamento. Por favor, aguarde alguns minutos e tente novamente."
        )

    # 2. Honeypot Validation
    if email_confirm or website:
        raise HTTPException(400, "Requisição inválida (spam detectado)")

    if not aceite_privacidade or not aceite_termos:
        raise HTTPException(400, "É necessário aceitar a política de privacidade e os termos de uso")

    # 3. Validação de comprimento dos campos
    if len(nome.strip()) < 2 or len(nome) > 200:
        raise HTTPException(400, "Nome inválido (2-200 caracteres)")
    if len(whatsapp.strip()) < 8 or len(whatsapp) > 30:
        raise HTTPException(400, "WhatsApp inválido")
    if descricao and len(descricao) > 2000:
        raise HTTPException(400, "Descrição muito longa (máx 2000 caracteres)")
    if observacoes and len(observacoes) > 1000:
        raise HTTPException(400, "Observações muito longas (máx 1000 caracteres)")

    # 3. Registrar solicitação no Redis
    await registrar_solicitacao_orcamento(ip)

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
        # 1. Validar quantidade
        # Filtrar imagens enviadas vazias
        imagens_validas = [img for img in imagens if img.filename]
        if len(imagens_validas) > 5:
            raise HTTPException(400, "Você pode enviar no máximo 5 imagens de referência.")

        ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
        MAX_SIZE = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024  # 15MB
        
        salvos_no_disco = []
        upload_dir = Path(settings.STORAGE_PATH) / "uploads" / str(estudio.id) / "atendimentos" / str(atendimento.id)

        try:
            for imagem in imagens_validas:
                # 2. Validar content_type
                if imagem.content_type not in ALLOWED_MIME:
                    raise HTTPException(415, f"Tipo de arquivo não permitido: {imagem.filename}. Use JPG, PNG ou WEBP.")
                
                # 3. Ler conteúdo e validar tamanho
                conteudo = await imagem.read()
                if len(conteudo) > MAX_SIZE:
                    raise HTTPException(413, f"O arquivo {imagem.filename} excede o tamanho máximo de {settings.UPLOAD_MAX_SIZE_MB}MB.")
                
                # Gerar nome de arquivo único e seguro
                ext = Path(imagem.filename).suffix.lower()
                if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
                    ext = ".jpg" # fallback/segurança
                novo_nome = f"{uuid.uuid4()}{ext}"
                
                upload_dir.mkdir(parents=True, exist_ok=True)
                caminho_arquivo = upload_dir / novo_nome
                
                # Salvar o arquivo
                with open(caminho_arquivo, "wb") as f:
                    f.write(conteudo)
                
                salvos_no_disco.append(caminho_arquivo)
                
                # Registrar no banco de dados
                atendimento_imagem = AtendimentoImagem(
                    atendimento_id=atendimento.id,
                    imagem_path=novo_nome
                )
                session.add(atendimento_imagem)
            
            await session.flush()

        except Exception as e:
            # Rollback físico: apagar todos os arquivos salvos em disco se der erro
            for path in salvos_no_disco:
                try:
                    if path.exists():
                        path.unlink()
                except Exception:
                    pass
            raise e

    protocolo = f"SI{str(atendimento.id).split('-')[0].upper()}"

    # Enviar email de notificação para o estúdio (silencioso se SMTP não configurado)
    if estudio.email_notificacao:
        from app.core.email import enviar_notificacao_orcamento
        import asyncio
        asyncio.create_task(enviar_notificacao_orcamento(
            email_destino=estudio.email_notificacao,
            nome_estudio=estudio.nome,
            slug=slug,
            protocolo=protocolo,
            nome_cliente=nome,
            whatsapp=whatsapp,
            descricao=descricao,
            estilo=estilo,
            parte_corpo=parte_corpo,
        ))

    return OrcamentoResponse(
        protocolo=protocolo,
        atendimento_id=str(atendimento.id),
        mensagem="Pedido de orçamento recebido com sucesso! Entraremos em contato em breve.",
    )


class PublicDocumentoResponse(BaseModel):
    id: uuid.UUID
    tipo: str
    titulo: str
    conteudo: Optional[str]
    assinado: bool
    data_assinatura: Optional[datetime] = None
    model_config = {"from_attributes": True}


async def _validar_token_doc(
    token: str,
    session: AsyncSession,
    acao: AcaoLink,
) -> tuple[Documento, DocumentoLinkAcesso]:
    """Valida token de acesso ao documento. Retorna (doc, link) ou lança 404."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    link = await session.scalar(
        select(DocumentoLinkAcesso).where(
            DocumentoLinkAcesso.token_hash == token_hash,
            DocumentoLinkAcesso.acao == acao,
            DocumentoLinkAcesso.revogado == False,
            DocumentoLinkAcesso.usado_em == None,
            DocumentoLinkAcesso.expira_em > datetime.now(timezone.utc),
        )
    )
    if not link:
        raise HTTPException(404, "Link inválido, expirado ou já utilizado")
    doc = await session.get(Documento, link.documento_id)
    if not doc:
        raise HTTPException(404, "Documento não encontrado")
    return doc, link


@router.get("/documentos/token/{token}", response_model=PublicDocumentoResponse)
async def obter_documento_por_token(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Acessa documento via token seguro de tempo limitado."""
    # Aceita token de VISUALIZAR ou ASSINAR para leitura
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    link = await session.scalar(
        select(DocumentoLinkAcesso).where(
            DocumentoLinkAcesso.token_hash == token_hash,
            DocumentoLinkAcesso.revogado == False,
            DocumentoLinkAcesso.expira_em > datetime.now(timezone.utc),
        )
    )
    if not link:
        raise HTTPException(404, "Link inválido ou expirado")
    doc = await session.get(Documento, link.documento_id)
    if not doc:
        raise HTTPException(404, "Documento não encontrado")
    return PublicDocumentoResponse(
        id=doc.id,
        tipo=doc.tipo.value,
        titulo=doc.titulo,
        conteudo=doc.conteudo,
        assinado=doc.assinado,
        data_assinatura=doc.data_assinatura,
    )


@router.post("/documentos/token/{token}/assinar", status_code=200)
async def assinar_documento_por_token(
    token: str,
    request: Request,
    nome_assinante: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Assina documento via token seguro. Captura IP/UA do request, não do body."""
    doc, link = await _validar_token_doc(token, session, AcaoLink.ASSINAR)

    if doc.assinado:
        raise HTTPException(400, "Documento já está assinado")

    now = datetime.now(timezone.utc)
    ip = (
        request.headers.get("x-forwarded-for", "")
        .split(",")[0]
        .strip()
        or (request.client.host if request.client else "unknown")
    )
    ua = request.headers.get("user-agent", "")

    doc.assinado = True
    doc.data_assinatura = now
    doc.ip_assinatura = ip
    doc.nome_assinante = nome_assinante
    doc.trilha_aceite = {
        "user_agent": ua,
        "nome_assinante": nome_assinante,
        "assinado_em": now.isoformat(),
    }

    link.usado_em = now
    link.ip_uso = ip
    link.user_agent_uso = ua

    await session.commit()
    return {"message": "Documento assinado com sucesso"}
