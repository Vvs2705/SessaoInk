"""Schemas Pydantic para Cliente."""

import uuid
from datetime import date

from pydantic import BaseModel


class ClienteBase(BaseModel):
    nome: str
    telefone: str | None = None
    instagram: str | None = None
    email: str | None = None
    data_nascimento: date | None = None
    observacoes: str | None = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: str | None = None
    telefone: str | None = None
    instagram: str | None = None
    email: str | None = None
    data_nascimento: date | None = None
    observacoes: str | None = None


class ClienteResponse(ClienteBase):
    id: uuid.UUID
    estudio_id: uuid.UUID
    ativo: bool

    model_config = {"from_attributes": True}
