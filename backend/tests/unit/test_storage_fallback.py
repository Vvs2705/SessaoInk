"""Testes do fallback de leitura R2→disco na transição de storage."""

import pytest

from app.core.storage import ObjetoNaoEncontradoError, _R2ComFallbackLocal


class _FakeBackend:
    def __init__(self, dados: dict[str, bytes]):
        self.dados = dados
        self.deletados: list[str] = []

    def save(self, key, data, content_type):
        self.dados[key] = data

    def read(self, key):
        if key not in self.dados:
            raise ObjetoNaoEncontradoError(key)
        return self.dados[key], "image/webp"

    def exists(self, key):
        return key in self.dados

    def delete(self, key):
        self.deletados.append(key)
        self.dados.pop(key, None)

    def list_keys(self, prefix):
        return [k for k in self.dados if k.startswith(prefix)]


def test_le_do_primario_quando_existe():
    primario = _FakeBackend({"uploads/a.webp": b"R2"})
    fallback = _FakeBackend({"uploads/a.webp": b"LOCAL"})
    s = _R2ComFallbackLocal(primario, fallback)
    assert s.read("uploads/a.webp")[0] == b"R2"


def test_fallback_para_disco_quando_falta_no_r2():
    primario = _FakeBackend({})  # R2 vazio (ainda não migrado)
    fallback = _FakeBackend({"uploads/old.webp": b"LOCAL"})
    s = _R2ComFallbackLocal(primario, fallback)
    assert s.read("uploads/old.webp")[0] == b"LOCAL"


def test_404_quando_falta_nos_dois():
    s = _R2ComFallbackLocal(_FakeBackend({}), _FakeBackend({}))
    with pytest.raises(ObjetoNaoEncontradoError):
        s.read("uploads/x.webp")


def test_save_vai_so_para_o_primario():
    primario = _FakeBackend({})
    fallback = _FakeBackend({})
    s = _R2ComFallbackLocal(primario, fallback)
    s.save("uploads/n.webp", b"novo", "image/webp")
    assert primario.dados["uploads/n.webp"] == b"novo"
    assert "uploads/n.webp" not in fallback.dados


def test_delete_remove_dos_dois():
    primario = _FakeBackend({"uploads/d.webp": b"1"})
    fallback = _FakeBackend({"uploads/d.webp": b"1"})
    s = _R2ComFallbackLocal(primario, fallback)
    s.delete("uploads/d.webp")
    assert "uploads/d.webp" in primario.deletados
    assert "uploads/d.webp" in fallback.deletados


def test_exists_verifica_os_dois():
    s = _R2ComFallbackLocal(_FakeBackend({}), _FakeBackend({"uploads/e.webp": b"1"}))
    assert s.exists("uploads/e.webp") is True
    assert s.exists("uploads/none.webp") is False
