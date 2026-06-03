"""Reconstroi os assets de marca da SessãoInk de forma profissional.

Problemas corrigidos:
- logo-wide.png tinha o fundo escuro "chapado" embutido -> virava uma caixa
  visivel sobre o fundo do app. Agora: fundo TRANSPARENTE (luma-key), recorte
  justo e padding uniforme.
- icon-192/512 + apple-touch eram um recorte torto do wordmark ("Sess..."").
  Agora: SIMBOLO (S + maquina) centralizado em um quadrado solido da marca,
  com safe-zone para maskable.

Fonte: brand_assets/sessaoink_logo_original.png (1672x941, fundo escuro, sem alpha)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "brand_assets" / "sessaoink_logo_original.png"
PUB = ROOT / "frontend" / "public"

INK_NIGHT = (5, 11, 18)  # #050B12 — fundo da marca

# Limiares do luma-key (V = max canal). Fundo near-black ~20; cor mais escura
# da logo (deep-teal #1E5F59) V~95. Rampa suave entre LO e HI.
KEY_LO = 30
KEY_HI = 85


def carregar_keyed() -> Image.Image:
    """Abre a logo original e devolve RGBA com o fundo escuro vazado em alpha."""
    img = Image.open(SRC).convert("RGB")
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    span = KEY_HI - KEY_LO
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            v = r if r >= g and r >= b else (g if g >= b else b)
            if v <= KEY_LO:
                a = 0
            elif v >= KEY_HI:
                a = 255
            else:
                a = int((v - KEY_LO) / span * 255)
            if a:
                opx[x, y] = (r, g, b, a)
    return out


def alpha_bbox(img: Image.Image, thresh: int = 8) -> tuple[int, int, int, int]:
    """Bounding box dos pixels com alpha > thresh."""
    a = img.getchannel("A")
    mask = a.point(lambda v: 255 if v > thresh else 0)
    bb = mask.getbbox()
    return bb if bb else (0, 0, img.width, img.height)


def col_tem_conteudo(img: Image.Image, thresh: int = 8) -> list[bool]:
    """Por coluna, True se ha algum pixel com alpha > thresh."""
    a = img.getchannel("A")
    w, h = img.size
    apx = a.load()
    cols: list[bool] = []
    for x in range(w):
        tem = False
        for y in range(h):
            if apx[x, y] > thresh:
                tem = True
                break
        cols.append(tem)
    return cols


def recortar_simbolo(keyed: Image.Image) -> Image.Image:
    """Extrai o simbolo (cluster da esquerda, antes do wordmark)."""
    cols = col_tem_conteudo(keyed)
    w = len(cols)
    # acha inicio do primeiro conteudo
    start = next((i for i, c in enumerate(cols) if c), 0)
    # acha o maior gap vazio dentro dos primeiros 45% (separa simbolo do texto)
    limite = int(w * 0.45)
    melhor_ini, melhor_len = -1, 0
    i = start
    while i < limite:
        if not cols[i]:
            j = i
            while j < w and not cols[j]:
                j += 1
            if (j - i) > melhor_len:
                melhor_ini, melhor_len = i, j - i
            i = j
        else:
            i += 1
    fim = melhor_ini if melhor_ini > 0 else limite
    crop = keyed.crop((start, 0, fim, keyed.height))
    bb = alpha_bbox(crop)
    return crop.crop(bb)


def salvar_wide(keyed: Image.Image) -> None:
    bb = alpha_bbox(keyed)
    logo = keyed.crop(bb)
    # padding uniforme = 6% da altura
    pad = int(logo.height * 0.06)
    canvas = Image.new(
        "RGBA", (logo.width + 2 * pad, logo.height + 2 * pad), (0, 0, 0, 0)
    )
    canvas.alpha_composite(logo, (pad, pad))
    # normaliza largura maxima p/ 1000px (peso menor, nitidez sobra)
    if canvas.width > 1000:
        nh = round(canvas.height * 1000 / canvas.width)
        canvas = canvas.resize((1000, nh), Image.LANCZOS)
    canvas.save(PUB / "logo-wide.png", optimize=True)
    print(f"  logo-wide.png  {canvas.width}x{canvas.height} (fundo transparente)")


def icone_quadrado(simbolo: Image.Image, lado: int, fill_ratio: float = 0.64) -> Image.Image:
    """Simbolo centralizado em quadrado solido da marca (safe-zone p/ maskable)."""
    canvas = Image.new("RGBA", (lado, lado), (*INK_NIGHT, 255))
    alvo = int(lado * fill_ratio)
    escala = alvo / max(simbolo.width, simbolo.height)
    nw, nh = max(1, round(simbolo.width * escala)), max(1, round(simbolo.height * escala))
    s = simbolo.resize((nw, nh), Image.LANCZOS)
    canvas.alpha_composite(s, ((lado - nw) // 2, (lado - nh) // 2))
    return canvas


def main() -> None:
    print("Lendo logo original e vazando fundo (luma-key)...")
    keyed = carregar_keyed()

    print("Gerando wide logo (transparente):")
    salvar_wide(keyed)

    print("Extraindo simbolo e gerando icones (simbolo centralizado):")
    simbolo = recortar_simbolo(keyed)
    print(f"  simbolo recortado: {simbolo.width}x{simbolo.height}")

    ic512 = icone_quadrado(simbolo, 512)
    ic512.convert("RGB").save(PUB / "icon-512.png", optimize=True)
    print("  icon-512.png  512x512")

    ic192 = icone_quadrado(simbolo, 192)
    ic192.convert("RGB").save(PUB / "icon-192.png", optimize=True)
    print("  icon-192.png  192x192")

    apple = icone_quadrado(simbolo, 180)
    apple.convert("RGB").save(PUB / "apple-touch-icon.png", optimize=True)
    print("  apple-touch-icon.png  180x180")

    # favicon multi-size (fill maior, fica legivel em 16px)
    fav = icone_quadrado(simbolo, 256, fill_ratio=0.78).convert("RGB")
    fav.save(
        PUB / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("  favicon.ico  16/32/48")

    print("OK.")


if __name__ == "__main__":
    main()
