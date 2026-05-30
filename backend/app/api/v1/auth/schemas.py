"""Schemas Pydantic para autenticação."""

import uuid
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    message: str = "Login realizado com sucesso"
    token_type: str = "cookie"


class UsuarioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    tipo: str
    estudio_id: uuid.UUID

    model_config = {"from_attributes": True}


class SenhaAlterarRequest(BaseModel):
    senha_atual: str
    senha_nova: str
