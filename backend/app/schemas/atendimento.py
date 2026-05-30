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
    valor_total: Optional[float]
    valor_sinal: Optional[float]
    data_sessao: Optional[datetime]
    ativo: bool

    model_config = {"from_attributes": True}
