"""P0-04 — Testes do pipeline de upload seguro compartilhado."""

import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.upload_security import (
    nome_arquivo_seguro,
    processar_imagem_segura,
)


def _png_bytes(com_exif: bool = False) -> bytes:
    img = Image.new("RGB", (8, 8), (123, 45, 67))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def _jpeg_com_exif() -> bytes:
    img = Image.new("RGB", (8, 8), (10, 20, 30))
    exif = img.getexif()
    exif[0x010E] = "descrição secreta"  # ImageDescription
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def test_png_valido_e_aceito_e_recodificado():
    res = processar_imagem_segura(_png_bytes(), "image/png")
    assert res.extensao == "png"
    assert res.content_type_real == "image/png"
    assert len(res.sha256) == 64
    # Conteúdo recodificado continua sendo um PNG válido
    assert res.conteudo[:8] == b"\x89PNG\r\n\x1a\n"


def test_html_com_mime_de_imagem_eh_rejeitado():
    html = b"<html><script>alert(1)</script></html>"
    with pytest.raises(HTTPException) as exc:
        processar_imagem_segura(html, "image/jpeg")
    assert exc.value.status_code == 415


def test_svg_eh_rejeitado():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
    with pytest.raises(HTTPException) as exc:
        processar_imagem_segura(svg, "image/svg+xml")
    assert exc.value.status_code == 415


def test_mime_declarado_inconsistente_com_conteudo_eh_rejeitado():
    # Conteúdo PNG mas declarado como JPEG
    with pytest.raises(HTTPException) as exc:
        processar_imagem_segura(_png_bytes(), "image/jpeg")
    assert exc.value.status_code == 415


def test_exif_eh_removido_na_recodificacao():
    entrada = _jpeg_com_exif()
    # sanity: a entrada realmente tem EXIF
    assert dict(Image.open(io.BytesIO(entrada)).getexif())
    res = processar_imagem_segura(entrada, "image/jpeg")
    saida_exif = dict(Image.open(io.BytesIO(res.conteudo)).getexif())
    assert not saida_exif  # EXIF removido


def test_nome_arquivo_seguro_e_imprevisivel_e_com_extensao():
    n1 = nome_arquivo_seguro("png")
    n2 = nome_arquivo_seguro("png")
    assert n1 != n2
    assert n1.endswith(".png")
    # Não contém nome de usuário/path
    assert "/" not in n1 and "\\" not in n1
