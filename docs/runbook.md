# Runbook de incidentes — SessãoInk

Severidade: **SEV1** (fora do ar) · **SEV2** (degradado) · **SEV3** (parcial).

## Triagem rápida
```bash
curl -s https://sessaoink-api.fly.dev/health   # API de pé?
curl -s https://sessaoink-api.fly.dev/ready    # DB + Redis ok?
flyctl status --app sessaoink-api
flyctl logs --app sessaoink-api
```

## API fora do ar (SEV1)
1. `flyctl status` — máquina parada? `flyctl machine start <id>`.
2. `flyctl logs` — erro de startup? Guardrail de config? Corrigir secret e redeploy.
3. Se deploy recente quebrou: **rollback** (ver docs/deploy.md).

## Banco indisponível (`/ready` → database error) (SEV1)
1. Verificar status do Neon (painel). Connection string correta no Fly secret?
2. Limite de conexões? Reduzir pool ou aguardar. Não rodar DDL destrutivo.

## Redis indisponível (`/ready` → redis error) (SEV2)
- Em produção o Redis é **fail-closed**: rate limit e revogação de token podem
  recusar. Verificar app Redis no Fly; reiniciar. Login pode ficar indisponível.

## Pico de 5xx (SEV2)
1. `flyctl logs` + Sentry. Identificar endpoint/stacktrace.
2. Se introduzido por deploy → rollback. Senão, hotfix + deploy.

## Pico de 403/429 (possível abuso ou bug de CSRF/rate-limit)
1. 403: checar `csrf_blocked` nos logs (Origin inesperado) — config de `ALLOWED_ORIGINS`?
2. 429: rate limit de login/orçamento. Confirmar se é ataque ou IP real mal resolvido.
3. Consultar `audit_logs` (`auth.login.failure`) por padrão de brute force.

## Login falhando para todos
- Verificar Redis (rate limit/refresh). Verificar `SECRET_KEY`/`JWT_*` não mudaram
  inesperadamente (mudança invalida sessões). `/ready` deve estar ok.

## Rollback emergencial
Ver `docs/deploy.md`. Sempre validar `/ready` e um login de teste após reverter.

## Contatos / canais
- Definir canal de incidentes (ex.: Slack #incidentes) e responsável de plantão.
