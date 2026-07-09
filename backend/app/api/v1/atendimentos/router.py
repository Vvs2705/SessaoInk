"""Router de Atendimentos."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import exigir_assinatura_ativa, get_usuario_atual
from app.core.database import get_session
from app.core.storage import listar_objetos, montar_key, resposta_imagem
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.usuario import TipoUsuario, Usuario
from app.schemas.atendimento import (
    AtendimentoCreate,
    AtendimentoResponse,
    AtendimentoStatusUpdate,
    AtendimentoUpdate,
)
from app.services.audit import log_event
from app.services.tenant import (
    get_atendimento_do_estudio,
    get_cliente_do_estudio,
    get_usuario_do_estudio,
)

# Enforcement de assinatura: todo o módulo exige trial vigente ou assinatura
# ativa (402 caso contrário) — rotas de pagamento/config/LGPD ficam isentas.
router = APIRouter(
    prefix="/atendimentos",
    tags=["atendimentos"],
    dependencies=[Depends(exigir_assinatura_ativa)],
)


async def _audit_atendimento(session, usuario, acao, atendimento_id, dados=None):
    await log_event(
        session,
        acao=acao,
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="atendimento",
        entidade_id=str(atendimento_id),
        dados=dados,
    )


def _atendimento_visivel_para_usuario(item: Atendimento, usuario: Usuario) -> bool:
    if usuario.tipo != TipoUsuario.ARTISTA:
        return True
    return item.artista_id == usuario.id


@router.get("/", response_model=list[AtendimentoResponse])
async def listar_atendimentos(
    status_op: StatusOperacional | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    q = select(Atendimento).where(
        Atendimento.estudio_id == usuario.estudio_id,
        Atendimento.ativo,
    )
    if status_op:
        q = q.where(Atendimento.status_operacional == status_op)
    if usuario.tipo == TipoUsuario.ARTISTA:
        q = q.where(Atendimento.artista_id == usuario.id)
    q = q.order_by(Atendimento.criado_em.desc())
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/", response_model=AtendimentoResponse, status_code=status.HTTP_201_CREATED)
async def criar_atendimento(
    dados: AtendimentoCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    dados_dict = dados.model_dump()
    if usuario.tipo == TipoUsuario.ARTISTA:
        if dados.artista_id is not None and dados.artista_id != usuario.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Artista so pode criar atendimentos para si.",
            )
        dados_dict["artista_id"] = usuario.id

    if dados.cliente_id:
        await get_cliente_do_estudio(
            session,
            cliente_id=dados.cliente_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Cliente inválido ou não pertence ao seu estúdio",
        )

    if dados_dict.get("artista_id"):
        await get_usuario_do_estudio(
            session,
            usuario_id=dados_dict["artista_id"],
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Artista inválido ou não pertence ao seu estúdio",
        )

    atendimento = Atendimento(estudio_id=usuario.estudio_id, **dados_dict)
    session.add(atendimento)
    await session.flush()
    await session.refresh(atendimento)
    await _audit_atendimento(session, usuario, "atendimento.created", atendimento.id)
    return atendimento


@router.get("/{id}", response_model=AtendimentoResponse)
async def obter_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
    if not _atendimento_visivel_para_usuario(item, usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atendimento nÃ£o encontrado")
    return item


@router.patch("/{id}", response_model=AtendimentoResponse)
async def atualizar_atendimento(
    id: uuid.UUID,
    dados: AtendimentoUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
    if not _atendimento_visivel_para_usuario(item, usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atendimento nao encontrado")

    if (
        usuario.tipo == TipoUsuario.ARTISTA
        and dados.artista_id is not None
        and dados.artista_id != usuario.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Artista so pode alterar atendimentos para si.",
        )

    if dados.cliente_id is not None:
        await get_cliente_do_estudio(
            session,
            cliente_id=dados.cliente_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Cliente inválido ou não pertence ao seu estúdio",
        )

    if dados.artista_id is not None:
        await get_usuario_do_estudio(
            session,
            usuario_id=dados.artista_id,
            estudio_id=usuario.estudio_id,
            active_only=True,
            not_found_status=status.HTTP_400_BAD_REQUEST,
            detail="Artista inválido ou não pertence ao seu estúdio",
        )

    campos = dados.model_dump(exclude_none=True)
    for k, v in campos.items():
        setattr(item, k, v)
    await session.flush()
    await session.refresh(item)
    await _audit_atendimento(
        session, usuario, "atendimento.updated", item.id,
        dados={"campos": sorted(campos.keys())},
    )
    return item


@router.patch("/{id}/status", response_model=AtendimentoResponse)
async def alterar_status(
    id: uuid.UUID,
    dados: AtendimentoStatusUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
    if not _atendimento_visivel_para_usuario(item, usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atendimento nao encontrado")
    if dados.status_operacional:
        item.status_operacional = dados.status_operacional
    if dados.status_financeiro:
        item.status_financeiro = dados.status_financeiro
    await session.flush()
    await session.refresh(item)
    await _audit_atendimento(
        session, usuario, "atendimento.status_changed", item.id,
        dados={
            "status_operacional": item.status_operacional.value if item.status_operacional else None,
            "status_financeiro": item.status_financeiro.value if item.status_financeiro else None,
        },
    )
    return item


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )
    if not _atendimento_visivel_para_usuario(item, usuario):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atendimento nao encontrado")
    item.ativo = False
    await _audit_atendimento(session, usuario, "atendimento.cancelled", item.id)


@router.get("/{id}/imagens", response_model=list[str])
async def listar_imagens_atendimento(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )

    prefix = montar_key(str(usuario.estudio_id), "atendimentos", str(id))
    exts = (".jpg", ".jpeg", ".png", ".webp")
    keys = await listar_objetos(prefix)
    nomes = [k.rsplit("/", 1)[-1] for k in keys]
    return [n for n in nomes if n.lower().endswith(exts)]


@router.get("/{id}/imagens/{filename}")
async def obter_imagem_atendimento(
    id: uuid.UUID,
    filename: str,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    await get_atendimento_do_estudio(
        session,
        atendimento_id=id,
        estudio_id=usuario.estudio_id,
        detail="Atendimento não encontrado",
    )

    # Defesa contra path traversal: nomes válidos são tokens seguros + extensão.
    if not re.fullmatch(r"[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)", filename):
        raise HTTPException(404, "Imagem não encontrada")

    key = montar_key(str(usuario.estudio_id), "atendimentos", str(id), filename)
    return await resposta_imagem(key)
