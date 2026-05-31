"""Configuração de logging estruturado JSON para produção."""
import logging
import json
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Formata logs como JSON — compatível com Datadog, Fly.io, CloudWatch."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "extra"):
            log_data.update(record.__dict__.get("extra", {}))
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data, ensure_ascii=False)


def configure_logging(environment: str) -> None:
    """Configura logging baseado no ambiente."""
    level = logging.WARNING if environment == "production" else logging.INFO

    handler = logging.StreamHandler()
    if environment == "production":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Silenciar loggers verbosos
    for noisy in ["sqlalchemy.engine", "uvicorn.access"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)
