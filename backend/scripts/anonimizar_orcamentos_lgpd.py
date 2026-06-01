"""Anonimiza orcamentos publicos vencidos pela politica LGPD."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import async_session
from app.services.lgpd import anonimizar_orcamentos_publicos_expirados

logger = logging.getLogger(__name__)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Anonimiza orcamentos publicos nao convertidos apos a retencao LGPD.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Conta candidatos sem gravar alteracoes.",
    )
    parser.add_argument(
        "--limite",
        type=int,
        default=None,
        help="Limite maximo de orcamentos a processar.",
    )
    return parser.parse_args()


async def _main() -> None:
    args = _parse_args()
    async with async_session() as session:
        resultado = await anonimizar_orcamentos_publicos_expirados(
            session,
            limite=args.limite,
            dry_run=args.dry_run,
        )
        if args.dry_run:
            await session.rollback()
        else:
            await session.commit()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logger.info(
        "LGPD orcamentos publicos: "
        "candidatos=%s anonimizados=%s dry_run=%s",
        resultado.candidatos,
        resultado.anonimizados,
        args.dry_run,
    )


if __name__ == "__main__":
    asyncio.run(_main())
