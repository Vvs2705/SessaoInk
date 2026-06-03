from urllib.parse import quote_plus

from app.models.usuario import Estudio


def endereco_completo_estudio(estudio: Estudio) -> str | None:
    linha_1 = ", ".join(
        [
            parte
            for parte in [
                estudio.endereco_logradouro,
                estudio.endereco_numero,
            ]
            if parte
        ]
    )

    linha_2 = " - ".join(
        [
            parte
            for parte in [
                estudio.endereco_bairro,
                estudio.endereco_cidade or estudio.cidade,
                estudio.endereco_uf or estudio.uf,
                estudio.endereco_cep,
            ]
            if parte
        ]
    )

    endereco = " · ".join([parte for parte in [linha_1, linha_2] if parte])

    return endereco or None


def como_chegar_url_estudio(estudio: Estudio) -> str | None:
    if estudio.google_negocio_url:
        return estudio.google_negocio_url

    endereco = endereco_completo_estudio(estudio)

    if not endereco:
        return None

    return f"https://www.google.com/maps/search/?api=1&query={quote_plus(endereco)}"


def validar_google_url(url: str | None) -> str | None:
    if not url:
        return None

    permitido = (
        "https://www.google.com/maps",
        "https://google.com/maps",
        "https://maps.app.goo.gl",
        "https://g.page",
        "https://business.google.com",
    )

    if not url.startswith(permitido):
        raise ValueError("Informe um link válido do Google Maps ou Google Negócios.")

    return url
