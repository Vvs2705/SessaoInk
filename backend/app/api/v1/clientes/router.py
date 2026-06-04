"""Router de Clientes."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate
from app.services.audit import log_event
from app.services.tenant import get_cliente_do_estudio


async def _audit_cliente(session, usuario, acao, cliente_id, dados=None):
    await log_event(
        session,
        acao=acao,
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="cliente",
        entidade_id=str(cliente_id),
        dados=dados,
    )

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("/", response_model=list[ClienteResponse])
async def listar_clientes(
    busca: str = "",
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    q = select(Cliente).where(
        Cliente.estudio_id == usuario.estudio_id,
        Cliente.ativo,
    )
    if busca:
        q = q.where(Cliente.nome.ilike(f"%{busca}%"))
    q = q.order_by(Cliente.nome)
    result = await session.execute(q)
    return result.scalars().all()


@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
async def criar_cliente(
    dados: ClienteCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    cliente = Cliente(estudio_id=usuario.estudio_id, **dados.model_dump())
    session.add(cliente)
    await session.flush()
    await session.refresh(cliente)
    await _audit_cliente(session, usuario, "cliente.created", cliente.id)
    return cliente


@router.get("/{id}", response_model=ClienteResponse)
async def obter_cliente(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    return await get_cliente_do_estudio(
        session,
        cliente_id=id,
        estudio_id=usuario.estudio_id,
        detail="Cliente não encontrado",
    )


@router.patch("/{id}", response_model=ClienteResponse)
async def atualizar_cliente(
    id: uuid.UUID,
    dados: ClienteUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    cliente = await get_cliente_do_estudio(
        session,
        cliente_id=id,
        estudio_id=usuario.estudio_id,
        detail="Cliente não encontrado",
    )
    campos = dados.model_dump(exclude_none=True)
    for k, v in campos.items():
        setattr(cliente, k, v)
    await session.flush()
    await session.refresh(cliente)
    await _audit_cliente(
        session, usuario, "cliente.updated", cliente.id,
        dados={"campos": sorted(campos.keys())},
    )
    return cliente


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_cliente(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    cliente = await get_cliente_do_estudio(
        session,
        cliente_id=id,
        estudio_id=usuario.estudio_id,
        detail="Cliente não encontrado",
    )
    cliente.ativo = False
    await _audit_cliente(session, usuario, "cliente.deleted", cliente.id)
