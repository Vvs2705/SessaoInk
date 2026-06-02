"""Schemas Pydantic para autenticação."""

import uuid

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    message: str = "Login realizado com sucesso"
    token_type: str = "cookie"


class LoginResponse(BaseModel):
    """Resposta do login. Se MFA estiver ativo, não emite sessão: retorna o
    desafio para o segundo fator."""

    message: str = "Login realizado com sucesso"
    token_type: str = "cookie"
    mfa_required: bool = False
    metodos: list[str] = []
    desafio: str | None = None


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code: str  # data URI (PNG base64)


class MfaAtivarRequest(BaseModel):
    codigo: str


class MfaDesativarRequest(BaseModel):
    senha: str


class MfaEmailToggleResponse(BaseModel):
    mfa_email_ativo: bool


class MfaDesafioRequest(BaseModel):
    desafio: str


class MfaVerificarRequest(BaseModel):
    desafio: str
    codigo: str
    metodo: str = "totp"  # "totp" | "email"


class UsuarioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    tipo: str
    estudio_id: uuid.UUID
    mfa_totp_ativo: bool = False
    mfa_email_ativo: bool = False

    model_config = {"from_attributes": True}


class SenhaAlterarRequest(BaseModel):
    senha_atual: str
    senha_nova: str
