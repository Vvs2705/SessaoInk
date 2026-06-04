"""P0-05 — detecção de dados de cartão e redaction de segredos (app/core/pci.py)."""

from app.core.pci import (
    REDACTED,
    contem_dados_cartao,
    motivo_dados_cartao,
    redigir_sensivel,
)

# Número de teste Visa (passa Luhn) — não é um cartão real.
PAN_TESTE = "4111111111111111"


class TestDeteccaoCartao:
    def test_payload_limpo_nao_dispara(self):
        assert contem_dados_cartao(
            {"plano_slug": "profissional", "ciclo": "mensal", "email": "a@b.com"}
        ) is False

    def test_campo_card_number_proibido(self):
        assert motivo_dados_cartao({"card_number": PAN_TESTE}) is not None

    def test_campo_cvv_proibido(self):
        assert motivo_dados_cartao({"cvv": "123"}) is not None

    def test_security_code_proibido(self):
        assert motivo_dados_cartao({"securityCode": "999"}) is not None

    def test_pan_em_valor_string(self):
        # PAN solto num campo de texto qualquer.
        assert motivo_dados_cartao({"observacao": f"meu cartao {PAN_TESTE}"}) is not None

    def test_aninhado(self):
        assert contem_dados_cartao(
            {"pagamento": {"dados": [{"card_number": PAN_TESTE}]}}
        ) is True

    def test_id_curto_nao_e_pan(self):
        assert motivo_dados_cartao({"id": "12345", "ref": "abc-123"}) is None


class TestRedaction:
    def test_redige_chaves_sensiveis(self):
        out = redigir_sensivel(
            {
                "Authorization": "Bearer xyz",
                "card_number": "4111111111111111",
                "token": "abc",
                "plano_slug": "profissional",
            }
        )
        assert out["Authorization"] == REDACTED
        assert out["card_number"] == REDACTED
        assert out["token"] == REDACTED
        # Campo não-sensível preservado.
        assert out["plano_slug"] == "profissional"

    def test_redige_aninhado(self):
        out = redigir_sensivel(
            {"req": {"headers": {"cookie": "s=1"}}, "lista": [{"senha": "x"}]}
        )
        assert out["req"]["headers"]["cookie"] == REDACTED
        assert out["lista"][0]["senha"] == REDACTED

    def test_nao_muta_original(self):
        original = {"token": "abc"}
        redigir_sensivel(original)
        assert original["token"] == "abc"
