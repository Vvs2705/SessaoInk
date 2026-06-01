# PLANO DE FINALIZACAO ATE 100% - SessaoInk

> Fonte unica de verdade desde 2026-06-01. O plano antigo
> `PLANO_CORRECAO_SESSAOINK.md` foi removido do repositorio e nao deve ser
> usado para retomadas.

---

## STATUS ATUAL

Estado alvo: 100% tecnico executavel no repositorio, com validacao local, CI
verde, secrets operacionais configurados, deploy em producao validado e dry-run
LGPD executado com sucesso.

Itens fechados:

- LGPD-1: endpoint admin + workflow GitHub Action + testes + auditoria
  `lgpd.anonymized`.
- LGPD operacional: workflow usa `LGPD_RETENTION_TOKEN`, sem senha humana de
  admin. Secret configurado no GitHub Actions e no Fly.
- P0-02: CSRF double-submit em modo estrito (`CSRF_STRICT_MODE=true`) para
  mutacoes autenticadas.
- P1-03: contrato OpenAPI versionado em `docs/openapi.json`, script e gate de CI.
- P0-03 incremental: owner-check granular para ARTISTA.
- P1-07: frontend sem `unsafe-eval` e sem `script-src 'unsafe-inline'`.
  `style-src 'unsafe-inline'` permanece documentado por compatibilidade com
  estilos inline existentes.
- MVP/UX: fluxos principais ja possuem estados de carregando/erro/vazio/sucesso
  e smoke E2E minimo versionado.
- Observabilidade: eventos PostHog sem PII e guia em `docs/observabilidade.md`.
- DevEx: pre-commit, changelog, release doc, OpenAPI e CI.
- Backup/restore: runbook atualizado, evidencia local versionada e decisao de
  object storage registrada como Cloudflare R2/S3-compatible.
- Housekeeping: documentos antigos removidos e este plano versionado.

Evidencias finais:

- Commit base de hardening: `fda6283 feat: fechar hardening final e operacao`.
- Commit de robustez LGPD em producao: `29188bb fix: robustecer comparacao do
  token LGPD`.
- CI principal verde: run `26775255712`.
- Backend Fly publicado: `sessaoink-api` versao 38, imagem
  `sessaoink-api:deployment-01KT28PV30PBDJDH21Y1Q9WJNE`.
- Frontend Vercel em producao: ultimo deploy `Ready`.
- Workflow `LGPD Retention` dry-run: run `26775438303` com sucesso.

## VALIDACAO LOCAL EXECUTADA

- Backend: `python -m pytest -q` -> 108 passed.
- Backend: `python -m ruff check app tests` -> passed.
- Backend: `python -m pyright app` -> 0 errors, warnings legados.
- Frontend: `npm run test -- client.test.ts` -> 4 passed.
- Frontend: `npm run typecheck` -> passed.
- Frontend: `npm run build` -> passed.
- Frontend: `npm audit --audit-level=high` -> exit 0; restam apenas avisos
  moderados herdados de `next/postcss`, sem high/critical.

## OPERACAO

- `LGPD_RETENTION_TOKEN` existe no GitHub Actions e no Fly.
- `CSRF_STRICT_MODE=true` existe no Fly.
- Backend redeployado no Fly apos o commit final.
- Frontend atualizado pela Vercel apos push no `main`.
- Verificacoes de producao executadas:
  - CI verde.
  - Fly `/ready`: `database=ok` e `redis=ok`.
  - Vercel `Ready`.
  - CSP publico sem `script-src 'unsafe-inline'`.
  - Workflow `LGPD Retention` com `dry_run=true` executado com sucesso.

## OBSERVACOES

- Restore PITR real no Neon exige acesso ao painel/API do projeto de producao.
  O repositorio contem ensaio local repetivel e sem PII em
  `docs/evidencias/restore-2026-06-01-local-rehearsal.md`.
- A migracao efetiva de arquivos para R2/S3 fica como evolucao de infraestrutura,
  mas a decisao operacional e as variaveis esperadas ja estao documentadas.
