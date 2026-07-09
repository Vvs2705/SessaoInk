"""Router de Convites — gerenciamento de convites para o estúdio."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import exigir_assinatura_ativa, require_role
from app.core.config import settings
from app.core.database import get_session
from app.core.password_policy import validar_senha_forte
from app.core.security import hash_senha
from app.models.convite import Convite, StatusConvite
from app.models.usuario import Estudio, TipoUsuario, Usuario
from app.services.audit import log_event

# Enforcement de assinatura por endpoint (NÃO no router): /info/{token} e
# /aceitar/{token} são públicos — o convidado ainda não tem sessão.
router = APIRouter(prefix="/convites", tags=["convites"])
_exige_assinatura = [Depends(exigir_assinatura_ativa)]

# Convites expiram em 7 dias por padrão
CONVITE_TTL_DIAS = 7

# Papéis que podem ser concedidos por convite. ADMIN é deliberadamente excluído:
# a promoção a administrador é uma ação sensível que não deve trafegar por um
# link de e-mail (evita escalonamento de privilégio se um convite vazar).
PAPEIS_CONVITAVEIS = {TipoUsuario.ARTISTA, TipoUsuario.RECEPCIONISTA}


def _convite_url(token_raw: str) -> str:
    return f"{settings.APP_URL}/convite/{token_raw}"


def _expirou(expira_em: datetime, agora: datetime) -> bool:
    """Compara expiração tolerando datetime naive (SQLite) vs aware (Postgres)."""
    if expira_em.tzinfo is None:
        expira_em = expira_em.replace(tzinfo=UTC)
    return expira_em < agora


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ConviteCreate(BaseModel):
    email: EmailStr
    role: TipoUsuario = TipoUsuario.ARTISTA

    @field_validator("role")
    @classmethod
    def _papel_convitavel(cls, v: TipoUsuario) -> TipoUsuario:
        if v not in PAPEIS_CONVITAVEIS:
            raise ValueError("Papel inválido para convite (apenas Artista ou Recepção).")
        return v


class ConviteResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    email: str
    role: TipoUsuario
    status: StatusConvite
    expira_em: datetime
    aceito_em: datetime | None = None
    criado_em: datetime
    # Preenchido apenas na criação (o token só existe em claro nesse instante).
    # Permite ao ADMIN copiar/compartilhar o link mesmo sem e-mail configurado.
    convite_url: str | None = None
    model_config = {"from_attributes": True}


class ConvitePublicoResponse(BaseModel):
    """Dados mínimos para a página pública de aceite (sem expor PII além do e-mail)."""
    email: str
    role: TipoUsuario
    nome_estudio: str
    expira_em: datetime


class AceitarConviteRequest(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
    senha: str = Field(min_length=8, max_length=200)

    _val_senha = field_validator("senha")(validar_senha_forte)


class AceitarConviteResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    tipo: TipoUsuario
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints protegidos (apenas ADMIN)
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=ConviteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=_exige_assinatura,
)
async def criar_convite(
    dados: ConviteCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Cria um convite para o estúdio. Apenas ADMIN pode convidar."""
    # Verificar se já existe convite pendente para este email no mesmo estúdio
    result = await session.execute(
        select(Convite).where(
            Convite.estudio_id == usuario.estudio_id,
            Convite.email == dados.email.lower(),
            Convite.status == StatusConvite.PENDENTE,
        )
    )
    existente = result.scalar_one_or_none()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um convite pendente para este e-mail.",
        )

    # Verificar se o email já é de um usuário ativo do estúdio
    result_usuario = await session.execute(
        select(Usuario).where(
            Usuario.estudio_id == usuario.estudio_id,
            Usuario.email == dados.email.lower(),
            Usuario.ativo,
        )
    )
    if result_usuario.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já pertence a um usuário ativo do estúdio.",
        )

    # Gerar token seguro e hash SHA-256
    token_raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token_raw.encode()).hexdigest()

    convite = Convite(
        estudio_id=usuario.estudio_id,
        email=dados.email.lower(),
        role=dados.role,
        token_hash=token_hash,
        status=StatusConvite.PENDENTE,
        expira_em=datetime.now(UTC) + timedelta(days=CONVITE_TTL_DIAS),
        convidado_por_id=usuario.id,
    )
    session.add(convite)
    await session.flush()

    await log_event(
        session,
        acao="usuario.invited",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="convite",
        entidade_id=str(convite.id),
        dados={"email": convite.email, "role": convite.role.value},
    )

    convite_url = _convite_url(token_raw)

    # Envia o e-mail de convite (silencioso se Resend não estiver configurado —
    # o ADMIN ainda compartilha o link manualmente pela UI).
    from app.core.email import enviar_convite_equipe

    estudio = await session.get(Estudio, usuario.estudio_id)
    background_tasks.add_task(
        enviar_convite_equipe,
        email_destino=convite.email,
        nome_estudio=estudio.nome if estudio else "seu estúdio",
        nome_convidante=usuario.nome,
        papel=convite.role.value,
        convite_url=convite_url,
    )

    # Resposta inclui o link em claro (única vez que o token existe sem hash).
    resp = ConviteResponse.model_validate(convite)
    resp.convite_url = convite_url
    return resp


@router.get("/", response_model=list[ConviteResponse], dependencies=_exige_assinatura)
async def listar_convites(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Lista todos os convites do estúdio. Apenas ADMIN."""
    result = await session.execute(
        select(Convite)
        .where(Convite.estudio_id == usuario.estudio_id)
        .order_by(Convite.criado_em.desc())
    )
    return result.scalars().all()


@router.delete(
    "/{convite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=_exige_assinatura,
)
async def revogar_convite(
    convite_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(require_role(TipoUsuario.ADMIN)),
):
    """Revoga um convite pendente. Apenas ADMIN."""
    result = await session.execute(
        select(Convite).where(
            Convite.id == convite_id,
            Convite.estudio_id == usuario.estudio_id,
        )
    )
    convite = result.scalar_one_or_none()
    if not convite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite não encontrado.")

    if convite.status != StatusConvite.PENDENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Convite não pode ser revogado (status atual: {convite.status}).",
        )

    convite.status = StatusConvite.REVOGADO
    await log_event(
        session,
        acao="usuario.invite.revoked",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="convite",
        entidade_id=str(convite.id),
    )


# ---------------------------------------------------------------------------
# Endpoints públicos — info + aceitar convite (sem sessão)
# ---------------------------------------------------------------------------


@router.get("/info/{token}", response_model=ConvitePublicoResponse)
async def info_convite(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Retorna dados mínimos do convite para a página pública de aceite.

    Não cria nada; serve para a UI mostrar o estúdio/papel antes do cadastro.
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    convite = await session.scalar(
        select(Convite).where(Convite.token_hash == token_hash)
    )
    if not convite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite inválido ou não encontrado.")
    if convite.status != StatusConvite.PENDENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este convite não está mais disponível.",
        )
    if _expirou(convite.expira_em, datetime.now(UTC)):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este convite expirou.")

    estudio = await session.get(Estudio, convite.estudio_id)
    return ConvitePublicoResponse(
        email=convite.email,
        role=convite.role,
        nome_estudio=estudio.nome if estudio else "Estúdio",
        expira_em=convite.expira_em,
    )


@router.post("/aceitar/{token}", response_model=AceitarConviteResponse, status_code=status.HTTP_201_CREATED)
async def aceitar_convite(
    token: str,
    dados: AceitarConviteRequest,
    session: AsyncSession = Depends(get_session),
):
    """Endpoint público — valida token e cria o usuário no estúdio."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await session.execute(
        select(Convite).where(Convite.token_hash == token_hash)
    )
    convite = result.scalar_one_or_none()

    if not convite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite inválido ou não encontrado.")

    if convite.status != StatusConvite.PENDENTE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Este convite não está mais disponível (status: {convite.status}).",
        )

    agora = datetime.now(UTC)
    if _expirou(convite.expira_em, agora):
        convite.status = StatusConvite.EXPIRADO
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Este convite expirou.")

    # Verificar se o email já está cadastrado (pode ter sido criado de outra forma)
    result_existente = await session.execute(
        select(Usuario).where(Usuario.email == convite.email)
    )
    if result_existente.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado.",
        )

    # Criar o usuário
    novo_usuario = Usuario(
        estudio_id=convite.estudio_id,
        nome=dados.nome.strip(),
        email=convite.email,
        senha_hash=hash_senha(dados.senha),
        tipo=convite.role,
        ativo=True,
    )
    session.add(novo_usuario)

    # Marcar convite como aceito
    convite.status = StatusConvite.ACEITO
    convite.aceito_em = agora

    await session.flush()
    await log_event(
        session,
        acao="usuario.invite.accepted",
        estudio_id=convite.estudio_id,
        actor_usuario_id=novo_usuario.id,
        actor_tipo=novo_usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(novo_usuario.id),
        dados={"role": novo_usuario.tipo.value, "via_convite": str(convite.id)},
    )
    return novo_usuario
