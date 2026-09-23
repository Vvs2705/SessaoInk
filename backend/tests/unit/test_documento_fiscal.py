"""Validação de CPF/CNPJ e checagem dos campos exigidos pela NFS-e.

Documento inválido só apareceria semanas depois, na recusa da prefeitura ao
emitir a nota — por isso a validação é barrada no cadastro.
"""

import pytest

from app.core.documento_fiscal import (
    campos_fiscais_faltando,
    documento_valido,
    formatar,
    limpar,
    tipo_documento,
)


class _Estudio:
    """Stub com os campos que `campos_fiscais_faltando` inspeciona."""

    def __init__(self, **kwargs):
        for campo in (
            "documento",
            "razao_social",
            "endereco_cep",
            "endereco_logradouro",
            "endereco_numero",
            "endereco_bairro",
            "endereco_cidade",
            "endereco_uf",
        ):
            setattr(self, campo, kwargs.get(campo))


def _estudio_completo(**overrides) -> _Estudio:
    base = {
        "documento": "40204602000185",
        "razao_social": "VSTACK SOLUTIONS LTDA",
        "endereco_cep": "07749220",
        "endereco_logradouro": "Rua Vicente Lisa",
        "endereco_numero": "6281",
        "endereco_bairro": "Vila Rosina",
        "endereco_cidade": "Caieiras",
        "endereco_uf": "SP",
    }
    base.update(overrides)
    return _Estudio(**base)


@pytest.mark.parametrize(
    "documento",
    [
        "529.982.247-25",
        "52998224725",
        "111.444.777-35",
        "40.204.602/0001-85",
        "40204602000185",
    ],
)
def test_documentos_validos(documento):
    assert documento_valido(documento)


@pytest.mark.parametrize(
    "documento",
    [
        None,
        "",
        "123",
        "529.982.247-24",          # DV errado
        "111.111.111-11",          # todos iguais
        "11111111111111",          # CNPJ todos iguais
        "40.204.602/0001-84",      # DV errado
        "5299822472",              # 10 dígitos
        "529982247253",            # 12 dígitos
    ],
)
def test_documentos_invalidos(documento):
    assert not documento_valido(documento)


def test_cnpj_alfanumerico_dv_numerico():
    """CNPJ alfanumérico (Receita, a partir de 2026): base pode ter letras,
    mas os dois dígitos verificadores nunca."""
    assert not documento_valido("40204602000WW5")  # DV com letra → inválido
    assert tipo_documento("12ABC34501DE35") == "cnpj"  # comprimento reconhecido


def test_tipo_e_formatacao():
    assert tipo_documento("52998224725") == "cpf"
    assert tipo_documento("40204602000185") == "cnpj"
    assert tipo_documento("123") is None
    assert formatar("52998224725") == "529.982.247-25"
    assert formatar("40204602000185") == "40.204.602/0001-85"
    assert formatar("123") == "123"  # inválido → devolve limpo, não quebra
    assert limpar(" 40.204.602/0001-85 ") == "40204602000185"


def test_campos_fiscais_completos():
    assert campos_fiscais_faltando(_estudio_completo()) == []


def test_campos_fiscais_faltando_lista_todos():
    vazio = _Estudio()
    faltando = campos_fiscais_faltando(vazio)
    assert set(faltando) == {
        "documento",
        "razao_social",
        "endereco_cep",
        "endereco_logradouro",
        "endereco_numero",
        "endereco_bairro",
        "endereco_cidade",
        "endereco_uf",
    }


def test_documento_invalido_conta_como_faltando():
    assert campos_fiscais_faltando(_estudio_completo(documento="11111111111")) == [
        "documento"
    ]


def test_campo_so_com_espacos_nao_vale():
    assert "endereco_numero" in campos_fiscais_faltando(
        _estudio_completo(endereco_numero="   ")
    )
