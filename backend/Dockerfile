FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Dependências do sistema (mínimo necessário)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python (layer separado para cache)
COPY requirements.lock .
RUN pip install --no-cache-dir --upgrade pip "setuptools>=78.1.1" \
    && pip install --no-cache-dir -r requirements.lock

# Código da aplicação
COPY . .

# Diretórios de storage (sobrescrito pelo volume Fly.io em produção)
RUN mkdir -p /storage/uploads /storage/exports

# Usuário não-root por segurança
RUN adduser --disabled-password --gecos "" appuser \
    && chown -R appuser:appuser /app /storage
USER appuser

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
