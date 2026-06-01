# Arquitetura — SessãoInk

```
                 ┌─────────────────────────────────────────────┐
   Browser ────> │ Vercel — Next.js 15 (App Router)            │
                 │  - Páginas (dashboard, portal público /[slug])│
                 │  - Middleware deny-by-default (auth)         │
                 │  - Proxy /api/v1/[...path] (server-side)     │
                 └───────────────┬─────────────────────────────┘
                                 │  fetch server-to-server (cookies, X-Origin-Browser, X-Forwarded-For)
                                 v
                 ┌─────────────────────────────────────────────┐
                 │ Fly.io — FastAPI                            │
                 │  - Auth (JWT + refresh no Redis)            │
                 │  - RBAC (require_role) + multi-tenant       │
                 │  - Upload seguro · Auditoria · Rate limit   │
                 └───────┬───────────────────────┬─────────────┘
                         v                       v
                 ┌──────────────┐        ┌──────────────┐
                 │ Neon Postgres│        │ Redis (Fly)  │
                 │ (SQLAlchemy) │        │ tokens/limits│
                 └──────────────┘        └──────────────┘
```

## Componentes
- **Observabilidade:** Sentry (frontend + backend), PostHog (frontend), logs JSON.
- **Email:** Resend (notificação de orçamento).
- **Migrações:** Alembic (SQL puro idempotente), aplicadas via `release_command` no deploy.

## Decisões-chave
- **Proxy same-origin** para manter cookies no domínio Vercel (`SameSite=Lax`),
  evitando loop de redirect e CSRF cross-site.
- **`NEXT_PUBLIC_API_URL` ausente** na Vercel ativa URLs relativas (modo proxy).
- **Redis fail-closed** em produção (rate limit/token nunca caem para memória).
- **Guardrails** abortam startup com config de produção insegura.

## Domínios de negócio (routers `app/api/v1/`)
agenda · atendimentos · auth · auditoria · busca · clientes · convites ·
documentos · estoque · estudio · financeiro · flash_arts · portfolio · publico ·
relatorios · usuarios.
