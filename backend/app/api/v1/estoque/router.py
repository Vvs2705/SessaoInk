"""Router de Estoque."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.financeiro import EstoqueItem, CategoriaEstoque
from app.models.usuario import Usuario

router = APIRouter(prefix="/estoque", tags=["estoque"])


class EstoqueItemCreate(BaseModel):
    nome: str
    categoria: CategoriaEstoque
    unidade: str = "un"
    quantidade_atual: float = 0
    quantidade_minima: float = 0
    preco_custo: Optional[float] = None


class EstoqueItemResponse(BaseModel):
    id: uuid.UUID
    nome: str
    categoria: CategoriaEstoque
    unidade: str
    quantidade_atual: float
    quantidade_minima: float
    preco_custo: Optional[float]
    ativo: bool
    alerta_minimo: bool = False

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_alert(cls, item: EstoqueItem) -> "EstoqueItemResponse":
        data = cls.model_validate(item)
        data.alerta_minimo = item.quantidade_atual <= item.quantidade_minima
        return data


@router.get("/", response_model=list[EstoqueItemResponse])
async def listar_estoque(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(EstoqueItem).where(
            EstoqueItem.estudio_id == usuario.estudio_id,
            EstoqueItem.ativo == True,
        ).order_by(EstoqueItem.nome)
    )
    itens = result.scalars().all()
    return [EstoqueItemResponse.from_orm_with_alert(i) for i in itens]


@router.post("/", response_model=EstoqueItemResponse, status_code=201)
async def criar_item(
    dados: EstoqueItemCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    item = EstoqueItem(estudio_id=usuario.estudio_id, **dados.model_dump())
    session.add(item)
    await session.flush()
    await session.refresh(item)
    return EstoqueItemResponse.from_orm_with_alert(item)


@router.get("/alertas", response_model=list[EstoqueItemResponse])
async def alertas_estoque(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    result = await session.execute(
        select(EstoqueItem).where(
            EstoqueItem.estudio_id == usuario.estudio_id,
            EstoqueItem.ativo == True,
            EstoqueItem.quantidade_atual <= EstoqueItem.quantidade_minima,
        )
    )
    itens = result.scalars().all()
    return [EstoqueItemResponse.from_orm_with_alert(i) for i in itens]


class AtualizarQuantidadeRequest(BaseModel):
    delta: float  # positivo = entrada, negativo = saída
    motivo: Optional[str] = None


@router.patch("/{id}/quantidade", response_model=EstoqueItemResponse)
async def atualizar_quantidade(
    id: uuid.UUID,
    dados: AtualizarQuantidadeRequest,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Adiciona ou remove quantidade do estoque (delta positivo = entrada, negativo = saída)."""
    result = await session.execute(
        select(EstoqueItem).where(
            EstoqueItem.id == id,
            EstoqueItem.estudio_id == usuario.estudio_id,
            EstoqueItem.ativo == True,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")

    nova_quantidade = item.quantidade_atual + dados.delta
    if nova_quantidade < 0:
        raise HTTPException(400, f"Quantidade insuficiente. Atual: {item.quantidade_atual}")

    item.quantidade_atual = nova_quantidade
    await session.flush()
    await session.refresh(item)
    return EstoqueItemResponse.from_orm_with_alert(item)


@router.delete("/{id}", status_code=204)
async def arquivar_item(
    id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Soft delete — marca o item como inativo (ADR-004)."""
    result = await session.execute(
        select(EstoqueItem).where(
            EstoqueItem.id == id,
            EstoqueItem.estudio_id == usuario.estudio_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item não encontrado")
    item.ativo = False
    await session.flush()
    return None
