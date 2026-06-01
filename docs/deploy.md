# Deploy — SessãoInk

## Backend (Fly.io)

```bash
cd backend
flyctl deploy --remote-only
```

- App: `sessaoink-api` (região GRU). `release_command = "alembic upgrade head"`
  roda as migrações automaticamente antes de subir a nova versão.
- Se a config de produção for insegura, o guardrail aborta o `release_command`
  → o deploy falha **sem downtime** (a versão anterior continua no ar).
- Secrets: `flyctl secrets set CHAVE=valor` (ex.: `SECRET_KEY`, `DATABASE_URL`,
  `REDIS_URL`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`, `ENVIRONMENT=production`).
- Verificar: `curl https://sessaoink-api.fly.dev/ready` → `{"status":"ready",...}`.

## Frontend (Vercel)

- Deploy automático a cada push em `main`.
- **Não definir `NEXT_PUBLIC_API_URL`** (ausência = modo proxy).
- Definir `BACKEND_URL=https://sessaoink-api.fly.dev` (server-only).
- Ao gravar env via PowerShell, evitar BOM: usar `[System.IO.File]::WriteAllText`
  com `UTF8Encoding $false`.

## Variáveis por ambiente

| Variável | Local | Produção |
|---|---|---|
| `ENVIRONMENT` | development | production |
| `DEBUG` | true | false |
| `DATABASE_URL` | localhost | Neon (não-localhost) |
| `REDIS_URL` | localhost | Fly Redis |
| `ALLOWED_ORIGINS` | localhost:3000 | domínios Vercel |
| `RESEND_API_KEY` | vazio | Fly secret |

## Migrações

```bash
cd backend
alembic revision -m "descricao"     # criar (preferir SQL puro idempotente)
alembic upgrade head                # aplicar
alembic downgrade -1                # reverter 1
alembic current && alembic history  # inspecionar
```
Migrações são revisadas em PR e validadas no CI (job "Migrations" em Postgres limpo).

## Smoke tests pós-deploy

```bash
curl -s https://sessaoink-api.fly.dev/health    # liveness
curl -s https://sessaoink-api.fly.dev/ready     # DB + Redis
# Frontend
curl -s -o /dev/null -w "%{http_code}" https://sessao-ink.vercel.app/login   # 200
```

## Rollback

- **Backend:** `flyctl releases` lista versões; `flyctl deploy` da imagem anterior ou
  `flyctl machine update --image <imagem-vX>`. Migrações: avaliar `alembic downgrade`
  **antes** de reverter código que dependa do schema.
- **Frontend:** na Vercel, "Promote to Production" de um deployment anterior.
- Sempre verificar `/ready` após rollback.
