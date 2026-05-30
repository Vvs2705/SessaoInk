"""Schemas Pydantic para Atendimento."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.atendimento import (
    StatusOperacional, StatusFinanceiro, TipoAtendimento, FormaPagamento
)


class AtendimentoCreate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    artista_id: Optional[uuid.UUID] = None
    tipo: TipoAtendimento = TipoAtendimento.TATUAGEM
    descricao: Optional[str] = None
    parte_corpo: Optional[str] = None
    estilo: Optional[str] = None
    tamanho_cm: Optional[str] = None
    valor_total: Optional[float] = None
    valor_sinal: Optional[float] = None
    forma_pagamento: Optional[FormaPagamento] = None
    notas_privadas: Optional[str] = None
    data_sessao: Optional[datetime] = None
    duracao_minutos: Optional[int] = None


class AtendimentoUpdate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    artista_id: Optional[uuid.UUID] = None
    tipo: Optional[TipoAtendimento] = None
    status_operacional: Optional[StatusOperacional] = None
    status_financeiro: Optional[StatusFinanceiro] = None
    descricao: Optional[str] = None
    parte_corpo: Optional[str] = None
    estilo: Optional[str] = None
    tamanho_cm: Optional[str] = None
    valor_total: Optional[float] = None
    valor_sinal: Optional[float] = None
    forma_pagamento: Optional[FormaPagamento] = None
    notas_privadas: Optional[str] = None
    data_sessao: Optional[datetime] = None
    duracao_minutos: Optional[int] = None


class AtendimentoStatusUpdate(BaseModel):
    status_operacional: Optional[StatusOperacional] = None
    status_financeiro: Optional[StatusFinanceiro] = None


class AtendimentoImagemResponse(BaseModel):
    id: uuid.UUID
    atendimento_id: uuid.UUID
    imagem_path: str

    model_config = {"from_attributes": True}


class ClienteAtendimentoResponse(BaseModel):
    id: uuid.UUID
    nome: str
    telefone: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class AtendimentoResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    cliente_id: Optional[uuid.UUID]
    artista_id: Optional[uuid.UUID]
    status_operacional: StatusOperacional
    status_financeiro: StatusFinanceiro
    tipo: TipoAtendimento
    descricao: Optional[str]
    parte_corpo: Optional[str]
    estilo: Optional[str]
    tamanho_cm: Optional[str] = None
    valor_total: Optional[float]
    valor_sinal: Optional[float]
    notas_privadas: Optional[str] = None
    data_sessao: Optional[datetime]
    ativo: bool
    cliente: Optional[ClienteAtendimentoResponse] = None
    imagens: list[AtendimentoImagemResponse] = []

    model_config = {"from_attributes": True}
