"""P0-04 — Pipeline de upload seguro compartilhado.

Usado por TODOS os pontos de upload de imagem (portfólio, flash arts, orçamento
público) para garantir o mesmo nível de validação:

  1. Limite de tamanho aplicado durante a leitura (lê no máx MAX_SIZE + 1).
  2. Detecção de tipo real por magic bytes (não confia no Content-Type declarado).
  3. Bloqueio de SVG/HTML/PDF/executáveis e MIME inconsistente.
  4. Re-encode com Pillow removendo EXIF/metadados (privacidade + anti-polyglot).
  5. Nome de arquivo gerado por token (nunca o filename original do usuário).
  6. Hash SHA-256 do conteúdo final para auditoria/deduplicação.
  7. Armazenamento fora de diretório público (sob STORAGE_PATH).
"""

import hashlib
import io
import secrets
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile
from PIL import Image

from app.core.config import settings

MAX_SIZE = settings.UPLOAD_MAX_SIZE_MB * 1024 * 1024

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}


@dataclass
class ImagemSegura:
    """Resultado do pipeline: bytes já limpos e prontos para persistir."""

    conteudo: bytes
    extensao: str
    content_type_real: str
    sha256: str


def _detectar(conteudo: bytes) -> tuple[str, str, str] | None:
    """Detecta (extensao, formato_pillow, mime_real) por magic bytes."""
    if conteudo[:3] == b"\xff\xd8\xff":
        return ("jpg", "JPEG", "image/jpeg")
    if conteudo[:8] == b"\x89PNG\r\n\x1a\n":
        return ("png", "PNG", "image/png")
    if conteudo[:4] == b"RIFF" and conteudo[8:12] == b"WEBP":
        return ("webp", "WEBP", "image/webp")
    return None


async def ler_upload_limitado(upload: UploadFile, max_bytes: int = MAX_SIZE) -> bytes:
    """Lê o upload com teto de tamanho — 413 ANTES de qualquer processamento/disco."""
    conteudo = await upload.read(max_bytes + 1)
    if len(conteudo) > max_bytes:
        raise HTTPException(
            413,
            f"Arquivo muito grande (máx {settings.UPLOAD_MAX_SIZE_MB}MB)",
        )
    if not conteudo:
        raise HTTPException(400, "Arquivo vazio")
    return conteudo


def processar_imagem_segura(
    conteudo: bytes, content_type_declarado: str | None = None
) -> ImagemSegura:
    """Valida e re-encoda a imagem, removendo metadados. Lança 415 se inválida.

    - Detecta tipo real por magic bytes (bloqueia SVG/HTML/PDF/exe → não casam).
    - Se o Content-Type declarado existir, deve ser permitido E consistente com o real.
    - Re-encode via Pillow descarta EXIF/ICC/metadados e neutraliza polyglots.
    """
    det = _detectar(conteudo)
    if det is None:
        raise HTTPException(
            415, "Tipo de arquivo não permitido — apenas JPEG, PNG ou WEBP"
        )
    ext, formato, mime_real = det

    if content_type_declarado:
        declarado = content_type_declarado.split(";")[0].strip().lower()
        if declarado not in ALLOWED_MIME:
            raise HTTPException(415, f"Content-Type não permitido: {declarado}")
        if declarado != mime_real:
            raise HTTPException(
                415,
                f"Content-Type ({declarado}) inconsistente com o conteúdo ({mime_real})",
            )

    try:
        img = Image.open(io.BytesIO(conteudo))
        img.load()
        # Normaliza modos exóticos (P/CMYK) para evitar perda na recodificação
        if img.mode not in ("RGB", "RGBA", "L"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        # Reconstrói a imagem só com os pixels — descarta TODOS os metadados
        limpo_img = Image.frombytes(img.mode, img.size, img.tobytes())
        out = io.BytesIO()
        limpo_img.save(out, format=formato)
        limpo = out.getvalue()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(415, "Imagem inválida ou corrompida") from e

    return ImagemSegura(
        conteudo=limpo,
        extensao=ext,
        content_type_real=mime_real,
        sha256=hashlib.sha256(limpo).hexdigest(),
    )


def nome_arquivo_seguro(extensao: str) -> str:
    """Nome de arquivo imprevisível — nunca deriva do filename do usuário."""
    return f"{secrets.token_urlsafe(24)}.{extensao}"


def salvar_imagem(imagem: ImagemSegura, *subdirs: str) -> str:
    """Persiste a imagem em `uploads/<subdirs>/<nome>` (local ou R2) e retorna o nome."""
    from app.core.storage import montar_key, storage

    nome = nome_arquivo_seguro(imagem.extensao)
    key = montar_key(*subdirs, nome)
    storage.save(key, imagem.conteudo, imagem.content_type_real)
    return nome


async def processar_upload(
    upload: UploadFile, *subdirs: str
) -> tuple[str, ImagemSegura]:
    """Pipeline completo: lê (limite) → valida/limpa → salva. Retorna (nome, ImagemSegura)."""
    conteudo = await ler_upload_limitado(upload)
    imagem = processar_imagem_segura(conteudo, upload.content_type)
    nome = salvar_imagem(imagem, *subdirs)
    return nome, imagem
