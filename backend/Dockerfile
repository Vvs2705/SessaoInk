FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Dependências do sistema (mínimo necessário). `apt-get upgrade` aplica os
# patches de segurança do Debian que a imagem base ainda não trouxe
# (ex.: zlib1g CVE-2026-85091, corrigido em +deb13u1).
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Dependências Python (layer separado para cache).
# Depois de instalar, o pip sai da imagem: nada roda pip em runtime
# (release_command = alembic) e o pip embute um pkg_resources do setuptools
# 70.3.0 que o Trivy acusa (CVE-2025-47273). Menos superfície no container.
COPY requirements.lock .
RUN pip install --no-cache-dir --upgrade pip "setuptools>=78.1.1" \
    && pip install --no-cache-dir -r requirements.lock \
    && python -m pip uninstall -y pip \
    && rm -rf /usr/local/lib/python3.12/ensurepip/_bundled

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
