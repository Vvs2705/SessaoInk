"""Validação de CPF/CNPJ do contratante — exigido para emitir NFS-e.

Tanto o padrão nacional da NFS-e quanto o sistema municipal de Caieiras/SP
(eTransparência) exigem o documento do tomador; sem ele a nota não é emitida
nem pode ser cancelada depois. Ver docs/fiscal-nfse.md.
"""

import re

__all__ = ["limpar", "tipo_documento", "documento_valido", "formatar"]

_NAO_ALFANUM = re.compile(r"[^0-9A-Za-z]")


def limpar(documento: str | None) -> str:
    """Remove máscara e normaliza caixa (CNPJ alfanumérico usa maiúsculas)."""
    return _NAO_ALFANUM.sub("", documento or "").upper()


def _dv(base: str, pesos: list[int]) -> int:
    """Dígito verificador módulo 11.

    Cada caractere vale `ord(c) - 48` — para dígitos isso é o próprio valor, e
    para letras cobre o CNPJ alfanumérico (Receita Federal, a partir de 2026).
    """
    soma = sum((ord(c) - 48) * p for c, p in zip(base, pesos))
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def tipo_documento(documento: str | None) -> str | None:
    """Retorna 'cpf', 'cnpj' ou None se o comprimento não bate."""
    limpo = limpar(documento)
    if len(limpo) == 11:
        return "cpf"
    if len(limpo) == 14:
        return "cnpj"
    return None


def documento_valido(documento: str | None) -> bool:
    """True se for CPF ou CNPJ com dígitos verificadores corretos."""
    limpo = limpar(documento)
    tipo = tipo_documento(limpo)
    if tipo is None:
        return False

    if tipo == "cpf":
        if not limpo.isdigit() or limpo == limpo[0] * 11:
            return False
        base, pesos1, pesos2 = limpo[:9], list(range(10, 1, -1)), list(range(11, 1, -1))
    else:
        # Os 12 primeiros caracteres podem ser alfanuméricos; os 2 DVs, nunca.
        if not limpo[12:].isdigit() or limpo == limpo[0] * 14:
            return False
        base = limpo[:12]
        pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    d1 = _dv(base, pesos1)
    d2 = _dv(base + str(d1), pesos2)
    return limpo.endswith(f"{d1}{d2}")


def formatar(documento: str | None) -> str:
    """Aplica máscara para exibição (e-mail, comprovante). Inválido → devolve limpo."""
    limpo = limpar(documento)
    tipo = tipo_documento(limpo)
    if tipo == "cpf":
        return f"{limpo[:3]}.{limpo[3:6]}.{limpo[6:9]}-{limpo[9:]}"
    if tipo == "cnpj":
        return f"{limpo[:2]}.{limpo[2:5]}.{limpo[5:8]}/{limpo[8:12]}-{limpo[12:]}"
    return limpo


# Endereço do tomador é obrigatório junto com o documento (padrão nacional da
# NFS-e e Caieiras/SP). `complemento` fica de fora — é opcional na nota.
CAMPOS_FISCAIS_OBRIGATORIOS = (
    "documento",
    "razao_social",
    "endereco_cep",
    "endereco_logradouro",
    "endereco_numero",
    "endereco_bairro",
    "endereco_cidade",
    "endereco_uf",
)


def campos_fiscais_faltando(estudio) -> list[str]:  # noqa: ANN001 — duck-typing p/ não importar model
    """Campos que impedem a emissão da nota fiscal. Vazio = pronto para emitir."""
    faltando = [
        campo
        for campo in CAMPOS_FISCAIS_OBRIGATORIOS
        if not (getattr(estudio, campo, None) or "").strip()
    ]
    doc = getattr(estudio, "documento", None)
    if doc and "documento" not in faltando and not documento_valido(doc):
        faltando.append("documento")
    return faltando
