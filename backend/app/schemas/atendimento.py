"""Schemas Pydantic para Atendimento."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.atendimento import (
    FormaPagamento,
    StatusFinanceiro,
    StatusOperacional,
    TipoAtendimento,
)


class AtendimentoCreate(BaseModel):
    cliente_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None
    tipo: TipoAtendimento = TipoAtendimento.TATUAGEM
    descricao: str | None = None
    parte_corpo: str | None = None
    estilo: str | None = None
    tamanho_cm: str | None = None
    valor_total: float | None = None
    valor_sinal: float | None = None
    forma_pagamento: FormaPagamento | None = None
    notas_privadas: str | None = None
    data_sessao: datetime | None = None
    duracao_minutos: int | None = None


class AtendimentoUpdate(BaseModel):
    cliente_id: uuid.UUID | None = None
    artista_id: uuid.UUID | None = None
    tipo: TipoAtendimento | None = None
    status_operacional: StatusOperacional | None = None
    status_financeiro: StatusFinanceiro | None = None
    descricao: str | None = None
    parte_corpo: str | None = None
    estilo: str | None = None
    tamanho_cm: str | None = None
    valor_total: float | None = None
    valor_sinal: float | None = None
    forma_pagamento: FormaPagamento | None = None
    notas_privadas: str | None = None
    data_sessao: datetime | None = None
    duracao_minutos: int | None = None


class AtendimentoStatusUpdate(BaseModel):
    status_operacional: StatusOperacional | None = None
    status_financeiro: StatusFinanceiro | None = None


class AtendimentoImagemResponse(BaseModel):
    id: uuid.UUID
    atendimento_id: uuid.UUID
    imagem_path: str

    model_config = {"from_attributes": True}


class ClienteAtendimentoResponse(BaseModel):
    id: uuid.UUID
    nome: str
    telefone: str | None = None
    instagram: str | None = None
    email: str | None = None

    model_config = {"from_attributes": True}


class AtendimentoResponse(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    cliente_id: uuid.UUID | None
    artista_id: uuid.UUID | None
    status_operacional: StatusOperacional
    status_financeiro: StatusFinanceiro
    tipo: TipoAtendimento
    descricao: str | None
    parte_corpo: str | None
    estilo: str | None
    tamanho_cm: str | None = None
    valor_total: float | None
    valor_sinal: float | None
    notas_privadas: str | None = None
    data_sessao: datetime | None
    duracao_minutos: int | None = None
    datas_preferidas: list[dict] | None = None
    horario_personalizado: str | None = None
    ativo: bool
    cliente: ClienteAtendimentoResponse | None = None
    imagens: list[AtendimentoImagemResponse] = []

    model_config = {"from_attributes": True}
