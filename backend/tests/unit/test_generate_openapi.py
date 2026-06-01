"""Contrato do script versionavel de OpenAPI."""

import json
import os
import subprocess
import sys
import uuid
from pathlib import Path


def test_generate_openapi_runs_with_debug_false():
    repo_root = Path(__file__).resolve().parents[3]
    backend_dir = repo_root / "backend"
    temp_dir = backend_dir / ".tmp" / "tests"
    temp_dir.mkdir(parents=True, exist_ok=True)
    output_path = temp_dir / f"openapi-{uuid.uuid4().hex}.json"

    env = {
        **os.environ,
        "ENVIRONMENT": "test",
        "DEBUG": "false",
        "SECRET_KEY": "ci-test-secret-key-32chars-minimum",
        "DATABASE_URL": "sqlite+aiosqlite:///./test.db",
        "REDIS_URL": "redis://localhost:6379",
        "PYTHONPATH": str(backend_dir),
    }

    result = subprocess.run(
        [
            sys.executable,
            str(backend_dir / "scripts" / "generate_openapi.py"),
            "--output",
            str(output_path),
        ],
        cwd=repo_root,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    try:
        assert result.returncode == 0, result.stderr
        schema = json.loads(output_path.read_text(encoding="utf-8"))
        assert schema["openapi"].startswith("3.")
        assert schema["info"]["title"] == "Sess\u00e3oInk API"
        assert "/health" in schema["paths"]
    finally:
        output_path.unlink(missing_ok=True)
