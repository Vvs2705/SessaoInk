"""Schemas Pydantic para Cliente."""

import uuid
from datetime import date
from typing import Optional
from pydantic import BaseModel


class ClienteBase(BaseModel):
    nome: str
    telefone: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[str] = None
    data_nascimento: Optional[date] = None
    observacoes: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[str] = None
    data_nascimento: Optional[date] = None
    observacoes: Optional[str] = None


class ClienteResponse(ClienteBase):
    id: uuid.UUID
    estudio_id: uuid.UUID
    ativo: bool

    model_config = {"from_attributes": True}
