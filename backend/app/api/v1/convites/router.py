"""Router de Convites — gerenciamento de convites para o estúdio."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import require_role
from app.core.database import get_session
from app.core.security import hash_senha
from app.models.convite import Convite, StatusConvite
from app.models.usuario import TipoUsuario, Usuario
from app.services.audit import log_event

router = APIRouter(prefix="/convites", tags=["convites"])

# Convites expiram em 7 dias por padrão
CONVITE_TTL_DIAS = 7


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ConviteCreate(BaseModel):
    email: EmailStr
    role: TipoUsuario = TipoUsuario.ARTISTA


class ConviteResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    email: str
    role: TipoUsuario
    status: StatusConvite
    expira_em: datetime
    aceito_em: datetime | None = None
    criado_em: datetime
    model_config = {"from_attributes": True}


class AceitarConviteRequest(BaseModel):
    nome: str
    senha: str


class AceitarConviteResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    tipo: TipoUsuario
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Endpoints protegidos (apenas ADMIN)
# ---------------------------------------------------------------------------


@router.post("/", response_model=ConviteResponse, status_code=status.HTTP_201_CREATED)
async def criar_convite(
    dados: ConviteCreate,
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

    # TODO: enviar email com link de convite contendo token_raw
    # O link seria: {FRONTEND_URL}/convite/aceitar/{token_raw}

    return convite


@router.get("/", response_model=list[ConviteResponse])
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


@router.delete("/{convite_id}", status_code=status.HTTP_204_NO_CONTENT)
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
# Endpoint público — aceitar convite
# ---------------------------------------------------------------------------


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
    if convite.expira_em < agora:
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
