"""Política central de força de senha.

Regra (definida pelo produto): mínimo 8 caracteres, com pelo menos uma letra
maiúscula, uma minúscula, um número e um caractere especial.

Observação de segurança (NIST SP 800-63B): regras de composição como esta são
amplamente exigidas por clientes/compliance, mas a evidência moderna mostra que
**comprimento** + **bloqueio de senhas vazadas** protege mais que classes
obrigatórias. Mantemos a regra pedida e deixamos o gancho para, no futuro,
checar contra listas de senhas comprometidas (HaveIBeenPwned k-anonymity).
"""

SENHA_MIN = 8
SENHA_MAX = 200

# Conjunto de especiais aceitos (amplo o bastante para não frustrar o usuário).
_ESPECIAIS = set("!@#$%^&*()-_=+[]{};:,.<>?/|\\\"'`~")

MENSAGEM_REGRA = (
    "A senha deve ter no mínimo 8 caracteres e incluir letra maiúscula, "
    "letra minúscula, número e caractere especial."
)


def validar_senha_forte(senha: str) -> str:
    """Valida a força da senha. Retorna a própria senha se válida; senão,
    levanta ValueError com mensagem acionável (Pydantic converte em 422)."""
    if not isinstance(senha, str) or len(senha) < SENHA_MIN or len(senha) > SENHA_MAX:
        raise ValueError(MENSAGEM_REGRA)
    if not any(c.islower() for c in senha):
        raise ValueError(MENSAGEM_REGRA)
    if not any(c.isupper() for c in senha):
        raise ValueError(MENSAGEM_REGRA)
    if not any(c.isdigit() for c in senha):
        raise ValueError(MENSAGEM_REGRA)
    if not any(c in _ESPECIAIS for c in senha):
        raise ValueError(MENSAGEM_REGRA)
    return senha
