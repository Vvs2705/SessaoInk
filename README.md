# SessãoInk

SaaS de gestão para tatuadores autônomos e estúdios de tatuagem — agenda,
clientes, atendimentos, financeiro, portfólio, flash arts, documentos/assinatura
e portal público por slug.

## Arquitetura

```
Browser ──> Vercel (Next.js 15 + proxy server-side) ──> Fly.io (FastAPI)
                                                              ├─ Neon PostgreSQL
                                                              └─ Redis (Fly)
```

- **Frontend:** Next.js 15 (App Router) · TypeScript · Tailwind · TanStack Query ·
  Sentry · PostHog — deploy na **Vercel** (`sessao-ink.vercel.app`).
- **Backend:** FastAPI · SQLAlchemy 2 async · Alembic · JWT — deploy no **Fly.io**
  (`sessaoink-api.fly.dev`, região GRU).
- **Proxy same-origin:** o frontend chama `/api/v1/...` (relativo); a rota
  `frontend/src/app/api/v1/[...path]/route.ts` encaminha ao backend server-side.
  Isso mantém cookies `SameSite=Lax` no domínio Vercel (sem CSRF cross-site).

> Regra crítica: **não definir `NEXT_PUBLIC_API_URL` na Vercel** — a ausência
> ativa o modo proxy (URLs relativas). Ver `docs/deploy.md`.

## Requisitos locais

- Python 3.12+, Node 20+, Docker (para Postgres/Redis locais).

## Rodar com Docker (recomendado)

```bash
cp .env.example .env          # preencha os valores
docker compose up --build
```

## Backend (sem Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check . && pyright && pytest -q
alembic upgrade head
uvicorn app.main:app --reload
```

## Frontend

```bash
cd frontend
npm ci --legacy-peer-deps
npm run typecheck && npm run build
npm run dev
```

## Testes

- Backend: `cd backend && pytest -q` (SQLite + MockRedis, autocontido — 84 testes).
- Frontend: `npm run typecheck` + `npm run build` (E2E Playwright em `tests/e2e`).
- CI (GitHub Actions) é **bloqueante**: ruff, pyright, pytest, migrations em
  Postgres limpo, build frontend, npm audit, pip-audit, gitleaks.

## Documentação

| Doc | Conteúdo |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Visão de componentes e fluxo |
| [docs/security.md](docs/security.md) | Auth, RBAC, multi-tenant, CSRF, cookies, LGPD |
| [docs/deploy.md](docs/deploy.md) | Deploy Vercel/Fly, variáveis, migrações, rollback |
| [docs/runbook.md](docs/runbook.md) | Incidentes: API/DB/Redis fora, 5xx, rollback |
| [docs/operacao-backup-restore.md](docs/operacao-backup-restore.md) | Backup/restore (Neon PITR) |

## Segurança

Nenhum segredo é versionado. `RESEND_API_KEY` vive apenas como secret do Fly
(`fly secrets set`). Ver `docs/security.md` e `.env.example`.
