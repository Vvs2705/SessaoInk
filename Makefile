# SessãoInk — atalhos de desenvolvimento
# Uso: make <alvo>   (Windows: usar via Git Bash/WSL ou rodar os comandos manualmente)

.PHONY: help dev-back dev-front test lint typecheck migrate docker-up check-back

help:
	@echo "Alvos: dev-back dev-front test lint typecheck migrate docker-up check-back"

dev-back:
	cd backend && uvicorn app.main:app --reload

dev-front:
	cd frontend && npm run dev

migrate:
	cd backend && alembic upgrade head

lint:
	cd backend && ruff check .

typecheck:
	cd backend && pyright
	cd frontend && npx tsc --noEmit

test:
	cd backend && pytest -q

# Espelha o job Backend do CI (lint + types + testes + smoke)
check-back:
	cd backend && pip install -r requirements.lock -r requirements-dev.txt && ruff check . && pyright && pytest -q

docker-up:
	docker compose up --build
