"""Router de Busca Global — pesquisa multi-entidade."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.models.atendimento import Atendimento
from app.models.cliente import Cliente
from app.models.portfolio import FlashArt
from app.models.usuario import Usuario

router = APIRouter(prefix="/busca", tags=["busca"])


# ---------------------------------------------------------------------------
# Schemas de resultado
# ---------------------------------------------------------------------------


class ResultadoCliente(BaseModel):
    id: uuid.UUID
    tipo: str = "cliente"
    titulo: str
    subtitulo: Optional[str] = None

    model_config = {"from_attributes": True}


class ResultadoAtendimento(BaseModel):
    id: uuid.UUID
    tipo: str = "atendimento"
    titulo: str
    subtitulo: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}


class ResultadoFlashArt(BaseModel):
    id: uuid.UUID
    tipo: str = "flash_art"
    titulo: str
    subtitulo: Optional[str] = None

    model_config = {"from_attributes": True}


class BuscaResponse(BaseModel):
    q: str
    total: int
    clientes: list[ResultadoCliente]
    atendimentos: list[ResultadoAtendimento]
    flash_arts: list[ResultadoFlashArt]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/", response_model=BuscaResponse)
async def buscar(
    q: str = Query(..., min_length=2, description="Termo de busca (mínimo 2 caracteres)"),
    limite: int = Query(default=5, ge=1, le=20),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
):
    """Busca global em clientes, atendimentos e flash arts do estúdio.

    Retorna até `limite` resultados por entidade.
    """
    estudio_id = usuario.estudio_id
    termo = f"%{q}%"

    # --- Clientes ---
    r_clientes = await session.execute(
        select(Cliente)
        .where(
            Cliente.estudio_id == estudio_id,
            Cliente.ativo == True,
            or_(
                Cliente.nome.ilike(termo),
                Cliente.email.ilike(termo),
                Cliente.telefone.ilike(termo),
                Cliente.instagram.ilike(termo),
            ),
        )
        .order_by(Cliente.nome)
        .limit(limite)
    )
    clientes = [
        ResultadoCliente(
            id=c.id,
            titulo=c.nome,
            subtitulo=c.email or c.telefone,
        )
        for c in r_clientes.scalars().all()
    ]

    # --- Atendimentos ---
    r_atend = await session.execute(
        select(Atendimento)
        .where(
            Atendimento.estudio_id == estudio_id,
            Atendimento.ativo == True,
            or_(
                Atendimento.descricao.ilike(termo),
                Atendimento.estilo.ilike(termo),
                Atendimento.parte_corpo.ilike(termo),
            ),
        )
        .order_by(Atendimento.criado_em.desc())
        .limit(limite)
    )
    atendimentos = [
        ResultadoAtendimento(
            id=a.id,
            titulo=a.descricao[:60] + "…" if a.descricao and len(a.descricao) > 60 else (a.descricao or f"Atendimento {str(a.id)[:8]}"),
            subtitulo=a.estilo or a.parte_corpo,
            status=a.status_operacional.value,
        )
        for a in r_atend.scalars().all()
    ]

    # --- Flash Arts ---
    r_flash = await session.execute(
        select(FlashArt)
        .where(
            FlashArt.estudio_id == estudio_id,
            FlashArt.ativo == True,
            FlashArt.titulo.ilike(termo),
        )
        .order_by(FlashArt.titulo)
        .limit(limite)
    )
    flash_arts = [
        ResultadoFlashArt(
            id=f.id,
            titulo=f.titulo,
            subtitulo=f.estilo,
        )
        for f in r_flash.scalars().all()
    ]

    total = len(clientes) + len(atendimentos) + len(flash_arts)
    return BuscaResponse(
        q=q,
        total=total,
        clientes=clientes,
        atendimentos=atendimentos,
        flash_arts=flash_arts,
    )
