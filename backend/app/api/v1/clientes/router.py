"""Router de Clientes."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.cliente import Cliente
from app.models.usuario import Usuario
from app.schemas.cliente import ClienteCreate, ClienteResponse, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("/", response_model=list[ClienteResponse])
async def listar_clientes(
    busca: str = "",
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    q = select(Cliente).where(
        Cliente.estudio_id == usuario.estudio_id,
        Cliente.ativo == True,
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
    return cliente


@router.get("/{id}", response_model=ClienteResponse)
async def obter_cliente(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Cliente).where(Cliente.id == id, Cliente.estudio_id == usuario.estudio_id)
    )
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@router.patch("/{id}", response_model=ClienteResponse)
async def atualizar_cliente(
    id: uuid.UUID,
    dados: ClienteUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Cliente).where(Cliente.id == id, Cliente.estudio_id == usuario.estudio_id)
    )
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    for k, v in dados.model_dump(exclude_unset=True).items():
        setattr(cliente, k, v)
    await session.flush()
    await session.refresh(cliente)
    return cliente


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def arquivar_cliente(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(Cliente).where(Cliente.id == id, Cliente.estudio_id == usuario.estudio_id)
    )
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    cliente.ativo = False
