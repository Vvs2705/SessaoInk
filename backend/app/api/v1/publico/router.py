"""Router do Portal Público — sem autenticação."""

import hashlib
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.redis import registrar_solicitacao_orcamento, verificar_limite_orcamento
from app.core.request_context import get_client_ip, get_user_agent
from app.core.upload_security import processar_upload
from app.models.atendimento import (
    Atendimento,
    AtendimentoImagem,
    StatusOperacional,
    TipoAtendimento,
)
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso
from app.models.portfolio import FlashArt, Portfolio, StatusFlash, VisibilidadePortfolio
from app.models.usuario import Estudio
from app.services.audit import log_event

router = APIRouter(prefix="/public", tags=["portal-público"])


class EstudioPublicoResponse(BaseModel):
    slug: str
    nome: str
    bio: str | None
    cidade: str | None
    uf: str | None
    instagram: str | None
    model_config = {"from_attributes": True}


class OrcamentoRequest(BaseModel):
    nome: str
    whatsapp: str
    instagram: str | None = None
    descricao: str | None = None
    estilo: str | None = None
    parte_corpo: str | None = None
    tamanho_cm: str | None = None
    observacoes: str | None = None
    aceite_privacidade: bool
    aceite_termos: bool


class OrcamentoResponse(BaseModel):
    protocolo: str
    atendimento_id: str
    mensagem: str


class PortfolioPublicoItem(BaseModel):
    id: str
    titulo: str | None
    descricao: str | None
    estilo: str | None
    parte_corpo: str | None
    imagem_path: str
    model_config = {"from_attributes": True}


@router.get("/{slug}", response_model=EstudioPublicoResponse)
async def perfil_publico(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
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
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    items_result = await session.execute(
        select(Portfolio)
        .where(
            Portfolio.estudio_id == estudio.id,
            Portfolio.visibilidade == VisibilidadePortfolio.PUBLICO,
            Portfolio.autorizado_publicacao,
            Portfolio.ativo,
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
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result_estudio.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result = await session.execute(
        select(Portfolio).where(
            Portfolio.id == pid,
            Portfolio.estudio_id == estudio.id,
            Portfolio.visibilidade == VisibilidadePortfolio.PUBLICO,
            Portfolio.autorizado_publicacao,
            Portfolio.ativo,
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
    descricao: str | None
    preco: float | None
    tamanho_sugerido: str | None
    local_recomendado: str | None
    has_imagem: bool


@router.get("/{slug}/flash-arts", response_model=list[FlashArtPublicaResponse])
async def flash_arts_publicas(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Retorna flash arts disponíveis do estúdio — sem autenticação."""
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result_flash = await session.execute(
        select(FlashArt).where(
            FlashArt.estudio_id == estudio.id,
            FlashArt.status == StatusFlash.DISPONIVEL,
            FlashArt.ativo,
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
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result_estudio.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    result = await session.execute(
        select(FlashArt).where(
            FlashArt.id == fid,
            FlashArt.estudio_id == estudio.id,
            FlashArt.status == StatusFlash.DISPONIVEL,
            FlashArt.ativo,
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
    instagram: str | None = Form(None),
    descricao: str | None = Form(None),
    estilo: str | None = Form(None),
    parte_corpo: str | None = Form(None),
    tamanho_cm: str | None = Form(None),
    observacoes: str | None = Form(None),
    aceite_privacidade: bool = Form(...),
    aceite_termos: bool = Form(...),
    email_confirm: str | None = Form(None),
    website: str | None = Form(None),
    imagens: list[UploadFile] | None = File(None),
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
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
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
    if imagens:
        # 1. Validar quantidade
        # Filtrar imagens enviadas vazias
        imagens_validas = [img for img in imagens if img.filename]
        if len(imagens_validas) > 5:
            raise HTTPException(400, "Você pode enviar no máximo 5 imagens de referência.")

        salvos_no_disco = []
        subdirs = (str(estudio.id), "atendimentos", str(atendimento.id))
        upload_dir = Path(settings.STORAGE_PATH).joinpath("uploads", *subdirs)

        try:
            for imagem in imagens_validas:
                # Pipeline seguro compartilhado (P0-04) — mesma validação do upload
                # privado: tamanho, magic bytes, MIME consistente, strip de EXIF,
                # nome de arquivo seguro. Upload público NÃO é exceção de segurança.
                novo_nome, _img = await processar_upload(imagem, *subdirs)
                salvos_no_disco.append(upload_dir / novo_nome)

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
        import asyncio

        from app.core.email import enviar_notificacao_orcamento
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
    conteudo: str | None
    assinado: bool
    data_assinatura: datetime | None = None
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
            DocumentoLinkAcesso.revogado.is_(False),
            DocumentoLinkAcesso.usado_em.is_(None),
            DocumentoLinkAcesso.expira_em > datetime.now(UTC),
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
            DocumentoLinkAcesso.revogado.is_(False),
            DocumentoLinkAcesso.expira_em > datetime.now(UTC),
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

    now = datetime.now(UTC)
    # IP/UA SEMPRE do servidor (P0-05/P0-06) — nunca do corpo da requisição.
    ip = get_client_ip(request)
    ua = get_user_agent(request)

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

    # P0-05/P0-10 — auditoria da assinatura (ator anônimo/público)
    await log_event(
        session,
        acao="documento.signed",
        estudio_id=doc.estudio_id,
        actor_tipo="publico",
        entidade="documento",
        entidade_id=str(doc.id),
        ip=ip,
        user_agent=ua,
        dados={"nome_assinante": nome_assinante},
    )

    await session.commit()
    return {"message": "Documento assinado com sucesso"}
