"""Migra os objetos do disco local (STORAGE_PATH) para o Cloudflare R2.

Idempotente: pula objetos que já existem no R2 (compara por key). A key é o
caminho relativo a STORAGE_PATH — idêntica nos dois backends, então é cópia 1:1
e as linhas do banco (que guardam só o nome do arquivo) continuam válidas.

Uso (no container Fly, com os secrets OBJECT_STORAGE_* ativos):
    python scripts/migrate_storage_to_r2.py            # migra de verdade
    python scripts/migrate_storage_to_r2.py --dry-run  # só lista o que faria

Seguro rodar quantas vezes quiser. Não apaga nada do disco.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Garante que `app` seja importável quando rodado de /app no container.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.storage import (  # noqa: E402
    LocalStorage,
    R2Storage,
    _content_type_por_key,
)


def _coletar_keys(base: Path) -> list[str]:
    if not base.exists():
        return []
    return [p.relative_to(base).as_posix() for p in base.rglob("*") if p.is_file()]


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    if not (settings.OBJECT_STORAGE_BUCKET and settings.OBJECT_STORAGE_ENDPOINT):
        print("ERRO: OBJECT_STORAGE_* não configurado — nada a fazer.")
        return 1

    base = Path(settings.STORAGE_PATH)
    keys = _coletar_keys(base)
    print(f"STORAGE_PATH={base} | {len(keys)} arquivo(s) encontrado(s)")
    if not keys:
        print("Nenhum arquivo local para migrar.")
        return 0

    local = LocalStorage()
    r2 = R2Storage(
        endpoint=settings.OBJECT_STORAGE_ENDPOINT,
        access_key=settings.OBJECT_STORAGE_ACCESS_KEY,
        secret_key=settings.OBJECT_STORAGE_SECRET_KEY,
        bucket=settings.OBJECT_STORAGE_BUCKET,
    )

    enviados = pulados = erros = 0
    for key in keys:
        try:
            if r2.exists(key):
                pulados += 1
                continue
            if dry_run:
                print(f"[dry-run] enviaria: {key}")
                enviados += 1
                continue
            data, _ = local.read(key)
            r2.save(key, data, _content_type_por_key(key))
            enviados += 1
            print(f"ok: {key}")
        except Exception as exc:  # noqa: BLE001
            erros += 1
            print(f"ERRO em {key}: {exc}")

    print(f"\nResumo: enviados={enviados} pulados(já no R2)={pulados} erros={erros}")
    return 0 if erros == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
