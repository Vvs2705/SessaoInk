"""Configuração de logging estruturado JSON para produção."""
import json
import logging
from contextvars import ContextVar
from datetime import UTC, datetime

# Correlation ID por request — propagado do proxy/frontend e incluído em todo log.
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


class JSONFormatter(logging.Formatter):
    """Formata logs como JSON — compatível com Datadog, Fly.io, CloudWatch."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        cid = correlation_id_var.get()
        if cid:
            log_data["correlation_id"] = cid
        if hasattr(record, "extra"):
            # P0-05 — redação de segredos/dados de cartão antes de emitir o log.
            from app.core.pci import redigir_sensivel

            log_data.update(redigir_sensivel(record.__dict__.get("extra", {})))
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
