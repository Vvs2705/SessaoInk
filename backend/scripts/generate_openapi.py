"""Generate the versioned OpenAPI contract for SessaoInk."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "openapi.json"

sys.path.insert(0, str(BACKEND_DIR))


def _set_default_env() -> None:
    os.environ.setdefault("ENVIRONMENT", "test")
    os.environ.setdefault("DEBUG", "false")
    os.environ.setdefault("SECRET_KEY", "openapi-generation-secret-key-32chars")
    os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate OpenAPI JSON from the FastAPI app.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output path. Defaults to {DEFAULT_OUTPUT}",
    )
    return parser


def generate_openapi() -> dict[str, Any]:
    _set_default_env()

    from app.main import app

    return app.openapi()


def main() -> None:
    args = _build_parser().parse_args()
    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    schema = generate_openapi()
    output_path.write_text(
        json.dumps(schema, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"OpenAPI contract written to {output_path}")


if __name__ == "__main__":
    main()
