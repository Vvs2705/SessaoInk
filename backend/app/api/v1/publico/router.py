"""Router do Portal Público — sem autenticação."""

import hashlib
import json
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.redis import registrar_solicitacao_orcamento, verificar_limite_orcamento
from app.core.request_context import get_client_ip, get_user_agent
from app.core.storage import montar_key, remover_objeto, resposta_imagem
from app.core.upload_security import processar_upload
from app.models.atendimento import (
    Atendimento,
    AtendimentoImagem,
    StatusOperacional,
    TipoAtendimento,
)
from app.models.cliente import Cliente
from app.models.consentimento import Consentimento
from app.models.documento import AcaoLink, Documento, DocumentoLinkAcesso
from app.models.portfolio import FlashArt, Portfolio, StatusFlash, VisibilidadePortfolio
from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.services.audit import log_event
from app.services.lgpd import MARCADOR_PRE_CADASTRO


def _hash_lgpd(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

router = APIRouter(prefix="/public", tags=["portal-público"])


class EstudioPublicoResponse(BaseModel):
    slug: str
    nome: str
    bio: str | None
    cidade: str | None
    uf: str | None
    instagram: str | None
    has_logo: bool = False
    has_foto: bool = False
    endereco_completo: str | None = None
    como_chegar_url: str | None = None
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


@router.get("/planos")
async def listar_planos():
    """Catálogo público de planos para a página de preços.

    IMPORTANTE: declarado ANTES de `/{slug}` para não ser capturado como slug.
    """
    from app.core.planos import TRIAL_DIAS, listar_planos_publicos

    return {"planos": listar_planos_publicos(), "trial_dias": TRIAL_DIAS}


class InteressePlanoRequest(BaseModel):
    nome: str
    contato: str  # WhatsApp ou e-mail
    plano: str
    ciclo: str = "mensal"
    mensagem: str | None = None
    # Honeypot anti-spam (deve vir vazio)
    website: str | None = None


@router.post("/planos/interesse", status_code=202)
async def registrar_interesse_plano(
    dados: InteressePlanoRequest,
    background_tasks: BackgroundTasks,
):
    """Captura interesse em um plano (lead) e notifica vendas por e-mail.

    Funcional sem gateway: enquanto o checkout do Mercado Pago não está ligado,
    este é o CTA real da página de preços. Declarado antes de `/{slug}`.
    """
    from app.core.planos import get_plano

    # Honeypot: bot preencheu campo oculto → descarta silenciosamente
    if dados.website:
        return {"ok": True}

    if len(dados.nome.strip()) < 2 or len(dados.nome) > 200:
        raise HTTPException(400, "Nome inválido (2-200 caracteres)")
    if len(dados.contato.strip()) < 5 or len(dados.contato) > 200:
        raise HTTPException(400, "Contato inválido")
    if dados.mensagem and len(dados.mensagem) > 1000:
        raise HTTPException(400, "Mensagem muito longa (máx 1000 caracteres)")
    if not get_plano(dados.plano):
        raise HTTPException(400, "Plano inválido")

    from app.core.email import enviar_lead_interesse_plano

    # BackgroundTasks: envio gerenciado pelo Starlette (sem fire-and-forget).
    background_tasks.add_task(
        enviar_lead_interesse_plano,
        nome=dados.nome.strip(),
        contato=dados.contato.strip(),
        plano=dados.plano,
        ciclo=dados.ciclo,
        mensagem=dados.mensagem,
    )
    return {
        "ok": True,
        "mensagem": "Recebemos seu interesse! Entraremos em contato em breve.",
    }


class EstudioSitemapItem(BaseModel):
    slug: str
    atualizado_em: datetime | None = None


@router.get("/estudios", response_model=list[EstudioSitemapItem])
async def listar_estudios_publicos(
    session: AsyncSession = Depends(get_session),
):
    """Slugs dos estúdios com presença pública (≥1 item de portfólio PUBLICO).

    Usado pelo sitemap do frontend para indexar os portais. Só lista estúdios
    ativos com conteúdo público — evita indexar páginas vazias (thin content) e
    estúdios que não publicaram nada.
    """
    rows = await session.execute(
        select(Estudio.slug, Estudio.atualizado_em)
        .join(Portfolio, Portfolio.estudio_id == Estudio.id)
        .where(
            Estudio.ativo,
            Portfolio.visibilidade == VisibilidadePortfolio.PUBLICO,
        )
        .distinct()
        .limit(5000)
    )
    return [EstudioSitemapItem(slug=s, atualizado_em=a) for s, a in rows.all()]


@router.get("/agenda-ics/{token}")
async def feed_agenda_ics(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Feed iCalendar privado da agenda do estúdio (token não-adivinhável).

    O tatuador assina esta URL no Google Agenda / Apple Calendar / Outlook e
    recebe as sessões (com notificação no celular) sem precisar de OAuth.
    Declarado antes de `/{slug}` por clareza de roteamento.
    """
    from fastapi.responses import Response

    if len(token) < 32:
        raise HTTPException(404, "Agenda não encontrada")

    estudio = await session.scalar(
        select(Estudio).where(Estudio.agenda_ics_token == token, Estudio.ativo)
    )
    if not estudio:
        raise HTTPException(404, "Agenda não encontrada")

    agora = datetime.now(UTC)
    rows = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == estudio.id,
            Atendimento.ativo,
            Atendimento.data_sessao.isnot(None),
            Atendimento.data_sessao >= agora - timedelta(days=30),
            Atendimento.status_operacional.notin_([
                StatusOperacional.CANCELADO_CLIENTE,
                StatusOperacional.CANCELADO_ESTUDIO,
            ]),
        )
        .order_by(Atendimento.data_sessao)
        .limit(500)
    )

    def _escape(texto: str) -> str:
        return (
            texto.replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace("\n", "\\n")
        )

    def _fmt(dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")

    linhas = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SessãoInk//Agenda//PT-BR",
        "CALSCALE:GREGORIAN",
        f"X-WR-CALNAME:{_escape(f'SessãoInk — {estudio.nome}')}",
    ]
    for s in rows.scalars().all():
        inicio = s.data_sessao
        if inicio is None:  # filtrado na query; guarda para o type checker
            continue
        fim = inicio + timedelta(minutes=s.duracao_minutos or 120)
        titulo = f"{s.tipo.value.title()}"
        if s.cliente and s.cliente.nome:
            titulo += f" — {s.cliente.nome}"
        detalhes = " | ".join(
            p for p in [s.estilo, s.parte_corpo, s.descricao] if p
        )
        linhas += [
            "BEGIN:VEVENT",
            f"UID:{s.id}@sessao-ink",
            f"DTSTAMP:{_fmt(agora)}",
            f"DTSTART:{_fmt(inicio)}",
            f"DTEND:{_fmt(fim)}",
            f"SUMMARY:{_escape(titulo)}",
            f"DESCRIPTION:{_escape(detalhes[:500])}" if detalhes else "DESCRIPTION:",
            f"STATUS:{'CONFIRMED' if s.status_operacional == StatusOperacional.CONFIRMADO else 'TENTATIVE'}",
            "END:VEVENT",
        ]
    linhas.append("END:VCALENDAR")

    return Response(
        content="\r\n".join(linhas) + "\r\n",
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "private, max-age=300"},
    )


class DisponibilidadeDia(BaseModel):
    data: str
    sessoes: int


class DisponibilidadeResponse(BaseModel):
    horario_funcionamento: dict | None
    dias_ocupados: list[DisponibilidadeDia]
    janela_dias: int


@router.get("/{slug}/disponibilidade", response_model=DisponibilidadeResponse)
async def disponibilidade_publica(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Visão pública da ocupação da agenda — só contagem por dia, sem detalhes.

    Usada na etapa final do orçamento para o cliente sugerir datas dentro do
    horário de funcionamento do estúdio.
    """
    estudio = await session.scalar(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")

    janela_dias = 60
    agora = datetime.now(UTC)
    fim = agora + timedelta(days=janela_dias)

    rows = await session.execute(
        select(Atendimento.data_sessao).where(
            Atendimento.estudio_id == estudio.id,
            Atendimento.ativo,
            Atendimento.data_sessao.isnot(None),
            Atendimento.data_sessao >= agora,
            Atendimento.data_sessao <= fim,
            Atendimento.status_operacional.notin_([
                StatusOperacional.CANCELADO_CLIENTE,
                StatusOperacional.CANCELADO_ESTUDIO,
            ]),
        )
    )
    contagem: dict[str, int] = {}
    for (dt,) in rows.all():
        chave = dt.date().isoformat()
        contagem[chave] = contagem.get(chave, 0) + 1

    return DisponibilidadeResponse(
        horario_funcionamento=estudio.horario_funcionamento,
        dias_ocupados=[
            DisponibilidadeDia(data=d, sessoes=n) for d, n in sorted(contagem.items())
        ],
        janela_dias=janela_dias,
    )


@router.get("/{slug}", response_model=EstudioPublicoResponse)
async def perfil_publico(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    from app.utils.endereco import como_chegar_url_estudio, endereco_completo_estudio

    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio:
        raise HTTPException(404, "Estúdio não encontrado")
    return EstudioPublicoResponse(
        slug=estudio.slug,
        nome=estudio.nome,
        bio=estudio.bio,
        cidade=estudio.cidade,
        uf=estudio.uf,
        instagram=estudio.instagram,
        has_logo=bool(estudio.logo_path),
        has_foto=bool(estudio.foto_path),
        endereco_completo=endereco_completo_estudio(estudio),
        como_chegar_url=como_chegar_url_estudio(estudio),
    )


@router.get("/{slug}/logo")
async def servir_logo_publica(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Serve a logo do estúdio no portal público (same-origin via proxy)."""
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio or not estudio.logo_path:
        raise HTTPException(404, "Logo não encontrada")
    return await resposta_imagem(
        montar_key(str(estudio.id), "branding", estudio.logo_path)
    )


@router.get("/{slug}/foto")
async def servir_foto_publica(
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    """Serve a foto/avatar do estúdio no portal público (same-origin via proxy)."""
    result = await session.execute(
        select(Estudio).where(Estudio.slug == slug, Estudio.ativo)
    )
    estudio = result.scalar_one_or_none()
    if not estudio or not estudio.foto_path:
        raise HTTPException(404, "Foto não encontrada")
    return await resposta_imagem(
        montar_key(str(estudio.id), "branding", estudio.foto_path)
    )


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

    key = montar_key(str(item.estudio_id), "portfolio", item.imagem_path)
    return await resposta_imagem(key)


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

    key = montar_key(str(flash.estudio_id), "flash_arts", flash.imagem_path)
    return await resposta_imagem(key)


_PERIODOS_VALIDOS = {"manha", "tarde", "noite"}


def _parse_datas_preferidas(raw: str | None) -> list[dict] | None:
    """Valida o JSON de preferências de data enviado pelo cliente (máx. 3).

    Formato aceito: [{"data": "2026-06-15", "periodo": "tarde"}, ...].
    """
    if not raw:
        return None
    try:
        itens = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(400, "Preferências de data inválidas")
    if not isinstance(itens, list) or len(itens) > 3:
        raise HTTPException(400, "Selecione no máximo 3 datas de preferência")

    hoje = date.today()
    limite = hoje + timedelta(days=180)
    validadas: list[dict] = []
    for item in itens:
        if not isinstance(item, dict):
            raise HTTPException(400, "Preferências de data inválidas")
        try:
            dia = date.fromisoformat(str(item.get("data", "")))
        except ValueError:
            raise HTTPException(400, "Data de preferência inválida")
        if dia < hoje or dia > limite:
            raise HTTPException(400, "Datas devem estar entre hoje e 6 meses à frente")
        periodo = str(item.get("periodo", "")).lower()
        if periodo not in _PERIODOS_VALIDOS:
            raise HTTPException(400, "Período de preferência inválido")
        validadas.append({"data": dia.isoformat(), "periodo": periodo})
    return validadas or None


@router.post("/{slug}/orcamento", response_model=OrcamentoResponse, status_code=201)
async def solicitar_orcamento(
    slug: str,
    request: Request,
    background_tasks: BackgroundTasks,
    nome: str = Form(...),
    whatsapp: str = Form(...),
    email: str | None = Form(None),
    instagram: str | None = Form(None),
    descricao: str | None = Form(None),
    estilo: str | None = Form(None),
    parte_corpo: str | None = Form(None),
    tamanho_cm: str | None = Form(None),
    observacoes: str | None = Form(None),
    datas_preferidas: str | None = Form(None),
    horario_personalizado: str | None = Form(None),
    aceite_privacidade: bool = Form(...),
    aceite_termos: bool = Form(...),
    email_confirm: str | None = Form(None),
    website: str | None = Form(None),
    imagens: list[UploadFile] | None = File(None),
    session: AsyncSession = Depends(get_session),
):
    # 1. Rate Limiting — usa o IP real do cliente (X-Forwarded-For validado), não
    # o do proxy Vercel/Fly; senão o limite vira um bucket global compartilhado.
    ip = get_client_ip(request)
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
    if email:
        email = email.strip().lower()
        if len(email) > 320 or "@" not in email or "." not in email.split("@")[-1]:
            raise HTTPException(400, "E-mail inválido")
    if horario_personalizado and len(horario_personalizado) > 300:
        raise HTTPException(400, "Horário personalizado muito longo (máx 300 caracteres)")
    preferencias = _parse_datas_preferidas(datas_preferidas)

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
    if email:
        notas += f" | Email: {email}"
    if observacoes:
        notas += f"\nObservações: {observacoes}"

    now = datetime.now(UTC)
    retencao_ate = now + timedelta(days=settings.LGPD_ORCAMENTO_RETENCAO_DIAS)

    # Pré-cadastro do cliente: reutiliza cadastro existente (mesmo telefone ou
    # e-mail no estúdio) ou cria um novo com os dados do formulário. O cliente
    # consentiu com a Política de Privacidade neste mesmo fluxo (LGPD).
    telefone_normalizado = whatsapp.strip()[:20]
    filtros_match = [Cliente.telefone == telefone_normalizado]
    if email:
        filtros_match.append(Cliente.email == email)

    cliente_existente = (
        await session.execute(
            select(Cliente)
            .where(
                Cliente.estudio_id == estudio.id,
                Cliente.ativo,
                or_(*filtros_match),
            )
            .order_by(Cliente.criado_em)
            .limit(1)
        )
    ).scalar_one_or_none()

    if cliente_existente:
        cliente = cliente_existente
        # Completa dados que o estúdio ainda não tinha (nunca sobrescreve).
        if email and not cliente.email:
            cliente.email = email
        if instagram and not cliente.instagram:
            cliente.instagram = instagram.strip()[:100]
    else:
        cliente = Cliente(
            estudio_id=estudio.id,
            nome=nome.strip()[:200],
            telefone=telefone_normalizado,
            instagram=instagram.strip()[:100] if instagram else None,
            email=email,
            observacoes=MARCADOR_PRE_CADASTRO,
        )
        session.add(cliente)
        await session.flush()

    # Criar atendimento automaticamente
    atendimento = Atendimento(
        estudio_id=estudio.id,
        cliente_id=cliente.id,
        status_operacional=StatusOperacional.SOLICITADO,
        tipo=TipoAtendimento.TATUAGEM,
        descricao=descricao,
        parte_corpo=parte_corpo,
        estilo=estilo,
        tamanho_cm=tamanho_cm,
        notas_privadas=notas,
        orcamento_publico=True,
        datas_preferidas=preferencias,
        horario_personalizado=(
            horario_personalizado.strip() if horario_personalizado else None
        ),
        lgpd_retencao_ate=retencao_ate,
    )
    session.add(atendimento)
    await session.flush()

    consentimento = Consentimento(
        estudio_id=estudio.id,
        atendimento_id=atendimento.id,
        origem="orcamento_publico",
        aceite_privacidade=aceite_privacidade,
        aceite_termos=aceite_termos,
        versao_privacidade=settings.LGPD_PRIVACIDADE_VERSAO,
        versao_termos=settings.LGPD_TERMOS_VERSAO,
        ip_hash=_hash_lgpd(get_client_ip(request)),
        user_agent_hash=_hash_lgpd(get_user_agent(request)),
    )
    session.add(consentimento)

    # Salvar imagens fisicamente se houver
    if imagens:
        # 1. Validar quantidade
        # Filtrar imagens enviadas vazias
        imagens_validas = [img for img in imagens if img.filename]
        if len(imagens_validas) > 5:
            raise HTTPException(400, "Você pode enviar no máximo 5 imagens de referência.")

        keys_salvas: list[str] = []
        subdirs = (str(estudio.id), "atendimentos", str(atendimento.id))

        try:
            for imagem in imagens_validas:
                # Pipeline seguro compartilhado (P0-04) — mesma validação do upload
                # privado: tamanho, magic bytes, MIME consistente, strip de EXIF,
                # nome de arquivo seguro. Upload público NÃO é exceção de segurança.
                novo_nome, _img = await processar_upload(imagem, *subdirs)
                keys_salvas.append(montar_key(*subdirs, novo_nome))

                # Registrar no banco de dados
                atendimento_imagem = AtendimentoImagem(
                    atendimento_id=atendimento.id,
                    imagem_path=novo_nome
                )
                session.add(atendimento_imagem)

            await session.flush()

        except Exception as e:
            # Rollback físico: apagar todos os objetos salvos (local ou R2) se der erro
            for key in keys_salvas:
                try:
                    await remover_objeto(key)
                except Exception:
                    pass
            raise e

    protocolo = f"SI{str(atendimento.id).split('-')[0].upper()}"

    # Enviar email de notificação para o estúdio. Fallback: se o estúdio não
    # configurou email_notificacao, notifica o e-mail do primeiro ADMIN — o
    # orçamento nunca fica sem aviso. BackgroundTasks garante a execução após
    # a resposta (asyncio.create_task podia ser cancelado/coletado antes de rodar).
    email_destino = estudio.email_notificacao
    if not email_destino:
        email_destino = (
            await session.execute(
                select(Usuario.email)
                .where(
                    Usuario.estudio_id == estudio.id,
                    Usuario.ativo,
                    Usuario.tipo == TipoUsuario.ADMIN,
                )
                .order_by(Usuario.criado_em)
                .limit(1)
            )
        ).scalar_one_or_none()

    if email_destino:
        from app.core.email import enviar_notificacao_orcamento

        background_tasks.add_task(
            enviar_notificacao_orcamento,
            email_destino=email_destino,
            nome_estudio=estudio.nome,
            slug=slug,
            protocolo=protocolo,
            nome_cliente=nome,
            whatsapp=whatsapp,
            descricao=descricao,
            estilo=estilo,
            parte_corpo=parte_corpo,
        )

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
