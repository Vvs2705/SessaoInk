"""Schemas Pydantic para autenticação."""

import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import validar_senha_forte


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class RegistroRequest(BaseModel):
    """Cadastro self-serve de um novo estúdio (cria estúdio + admin + trial)."""

    nome_estudio: str = Field(min_length=2, max_length=200)
    nome: str = Field(min_length=2, max_length=200)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=200)
    website: str | None = None  # honeypot anti-bot (deve vir vazio)

    _val_senha = field_validator("senha")(validar_senha_forte)


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


class EsqueciSenhaRequest(BaseModel):
    email: EmailStr


class ResetarSenhaRequest(BaseModel):
    token: str = Field(min_length=20, max_length=300)
    senha_nova: str = Field(min_length=8, max_length=200)

    _val_senha = field_validator("senha_nova")(validar_senha_forte)
