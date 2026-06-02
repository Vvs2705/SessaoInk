"""Helpers de MFA — TOTP (RFC 6238) e OTP por e-mail.

Imports de `pyotp`/`qrcode` são lazy (dentro das funções) para que o módulo
permaneça importável em ambientes sem os pacotes (paridade com boto3/resend).
"""

import base64
import io
import secrets

# Janela de validação TOTP: aceita o passo atual ±1 (tolera ~30s de drift).
TOTP_VALID_WINDOW = 1
# Dígitos do OTP por e-mail.
EMAIL_OTP_DIGITOS = 6


def gerar_secret_totp() -> str:
    """Gera um segredo base32 para TOTP."""
    import pyotp

    return pyotp.random_base32()


def uri_provisionamento_totp(secret: str, email: str, emissor: str = "SessãoInk") -> str:
    """Retorna a otpauth:// URI para QR Code (compatível com Google/Microsoft Authenticator)."""
    import pyotp

    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=emissor)


def verificar_totp(secret: str, codigo: str) -> bool:
    """Valida o código TOTP de 6 dígitos contra o segredo."""
    import pyotp

    if not secret or not codigo:
        return False
    codigo = codigo.strip().replace(" ", "")
    return bool(pyotp.TOTP(secret).verify(codigo, valid_window=TOTP_VALID_WINDOW))


def gerar_qr_base64(uri: str) -> str:
    """Gera um PNG do QR Code da URI e retorna como data URI base64 (same-origin friendly)."""
    import qrcode

    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")  # type: ignore[call-arg]
    b64 = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def gerar_codigo_email() -> str:
    """Gera um OTP numérico de 6 dígitos para envio por e-mail."""
    return f"{secrets.randbelow(10**EMAIL_OTP_DIGITOS):0{EMAIL_OTP_DIGITOS}d}"


def comparar_codigo(a: str, b: str) -> bool:
    """Comparação de OTP resistente a timing."""
    return secrets.compare_digest(str(a).strip(), str(b).strip())
