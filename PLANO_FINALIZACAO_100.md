# PLANO DE FINALIZAÇÃO ATÉ 100% — SessãoInk

> Auditoria ORQUESTRADOR de 2026-06-01 (modo verificação, sem ações corretivas).
> Este arquivo lista o que FALTA e COMO concluir cada item até 100% dos dois
> documentos (`SESSAOINK_ORDEM_CORRECAO_TECNICA` + `RELATORIO_AUDITORIA`).
> Siga o **loop de qualidade** do `HANDOFF_ANTIGRAVITY.md` §2 em cada item.

---

## ✅ JÁ CONCLUÍDO E VERIFICADO (CI verde, prod v32)

- **P0-01,03,04,05,06,07,08,09,10** (sessão anterior).
- **P1-05** correlation_id ponta a ponta (`7bdb189`).
- **P1-01** tenant helpers `services/tenant.py` + routers refatorados + testes (`b67d6f3`).
- **P2-03** índices compostos (migration `e4f5a6b7c8d9`) (`b67d6f3`).
- **P2-02** Docker/SBOM scan (Trivy + CycloneDX, advisory) (`b67d6f3`).
- **P1-02** `requirements.lock` (lock de runtime) (`95e612c`).
- **P1-03** LGPD infra: model `consentimento.py`, `services/lgpd.py`, config 180d,
  migration `f5a6b7c8d9e0` (`95e612c`). ⚠️ ver gap LGPD-1 abaixo.
- CI bloqueante: **94 testes**, migrations em Postgres limpo, prod `/ready` OK.

**Estado:** HEAD `95e612c` · backend Fly **v32** · migration head `f5a6b7c8d9e0`.

---

## ❌ O QUE FALTA PARA 100% (ordenado por prioridade)

### 🔴 PRIORIDADE 1 — Segurança / Compliance (bloqueadores reais)

#### LGPD-1 — Anonimização nunca é executada (gap crítico de compliance)
- **Problema:** `app/services/lgpd.py::anonimizar_orcamentos_publicos_expirados()`
  existe mas **não é chamada em lugar nenhum** (sem cron, sem endpoint, sem job).
  A "retenção automática após 180 dias" (decisão do usuário) **não está ativa**.
- **Como corrigir (escolher 1):**
  - (a) Endpoint admin `POST /api/v1/admin/lgpd/anonimizar` (`require_role(ADMIN)`)
    que invoca a função — disparo manual/externo via cron da plataforma.
  - (b) Job agendado: GitHub Action (cron diário) chamando o endpoint (a), OU
    APScheduler no startup do FastAPI (cuidado com múltiplas instâncias).
  - **Recomendado:** (a) + GitHub Action diária autenticada. Simples e auditável.
- **Aceite:** rodar o gatilho anonimiza orçamentos não convertidos com > 180 dias
  (remove nome/whatsapp/IP/imagens), gera evento de auditoria `lgpd.anonymized`,
  e é idempotente. Teste de integração com data simulada.
- **Arquivos:** novo `app/api/v1/admin/router.py` (ou em auditoria), `.github/workflows/lgpd-retention.yml`, `tests/integration/test_lgpd.py`.

#### P0-02 — CSRF double-submit (não implementado)
- **Estado atual:** defesa via SameSite=Lax + validação de Origin em 2 camadas
  (proxy + backend `X-Origin-Browser`) — **aceitável** pelo RELATORIO P0-03, mas a
  ORDEM exige double-submit. Hoje só existe o header em `allow_headers` (CORS).
- **Como corrigir (rollout SEGURO, isolado — validar fluxo logado com o usuário):**
  1. Backend: setar cookie `csrf_token` (não-HttpOnly, Secure em prod, SameSite=Lax)
     em login/refresh; limpar em logout/logout-all.
  2. Middleware backend: em POST/PUT/PATCH/DELETE exigir `X-CSRF-Token == csrf_token`.
     **Tolerante** (só exige se o cookie existir) por 1 ciclo de deploy p/ não deslogar
     todos; depois estrito. Endpoints `/public/*` e `/auth/login` isentos.
  3. Frontend: ler `csrf_token` de `document.cookie` e injetar `X-CSRF-Token` em
     **todas** as mutações. ⚠️ AUDITAR TODOS os call-sites de fetch antes de exigir.
  4. Proxy `login/route.ts` já encaminha Set-Cookie (split) → cookie chega ao browser.
- **Aceite:** POST/PUT/PATCH/DELETE autenticado sem header válido → 403; GET/HEAD isentos;
  endpoints públicos isentos; fluxo logado real testado pós-deploy.
- **Arquivos:** `backend/app/main.py` (middleware), `auth/router.py` (cookie),
  `frontend/src/lib/api/client.ts` + call-sites, `tests/integration/test_csrf.py`.

---

### 🟡 PRIORIDADE 2 — Hardening / Contratos

#### P1-07 (doc2) — CSP: remover `unsafe-inline` / `unsafe-eval`
- **Estado:** `frontend/next.config.*` ainda tem `script-src 'self' 'unsafe-eval'
  'unsafe-inline'` e `style-src 'self' 'unsafe-inline'`.
- **Como corrigir:** migrar para nonce/hash; testar Next.js 15 + Sentry/PostHog
  (alguns exigem ajustes). Remover `unsafe-eval` primeiro (mais perigoso), depois
  `unsafe-inline` de script. Manter `style-src unsafe-inline` só se Tailwind exigir.
- **Aceite:** app funciona sem erros de CSP no console; build verde; validado em staging.
- **Risco:** ALTO (pode quebrar runtime) — isolar e testar visualmente.

#### P1-03 (doc2) — Contratos OpenAPI versionados
- **Estado:** sem `openapi.json` versionado nem `docs/api.md`.
- **Como corrigir:** script que exporta o schema do FastAPI (`app.openapi()`) para
  `backend/openapi.json` em build/CI; opcional gerar tipos no frontend. Documentar erros
  padronizados (401/403/404/422/409/429) em `docs/api.md`.
- **Aceite:** `openapi.json` versionado e atualizado no CI; `docs/api.md` criado.

#### P0-03 incremental — Owner-check granular ARTISTA
- **Estado:** RBAC por papel feito; falta checagem de **instância** (ARTISTA só acessa
  o próprio recurso vinculado a `usuario.id`).
- **Como corrigir:** nos helpers de tenant/owner, validar `artista_id == usuario.id`
  para ARTISTA em portfólio/flash/agenda próprios. +testes parametrizados.

---

### 🟢 PRIORIDADE 3 — Produto / MVP (RELATORIO P1-04/P1-05)

#### MVP-1 — Completar fluxos funcionais e estados de UX
- **Escopo (validar por tela, com teste E2E mínimo):** autenticação, clientes, agenda
  (conflito de horário), atendimentos (`/atendimentos/[id]`), financeiro (pago/estorno),
  documentos (aceite/auditoria), portfólio/flash (publicar/despublicar), portal público
  (orçamento, rate limit, anti-spam, validação).
- **Estados obrigatórios em cada tela:** carregando, vazio, erro, sucesso, sem permissão.
- **Aceite:** cada fluxo com UI funcional + validação backend + erro amigável + smoke E2E.
- **Obs:** maior esforço; quebrar por tela; não-bloqueante de segurança.

---

### ⚪ PRIORIDADE 4 — Observabilidade / DevEx (P2/P3)

- **P2-01 dashboards:** eventos PostHog (registro, login, lead, orçamento, atendimento,
  pagamento, documento aceito) + alertas Sentry (5xx, `/ready` 503, latência, pico de login).
- **P2-04 docs:** `docs/api.md` (ver acima); diagrama em `docs/architecture.md` (já há base).
- **P3-01 DevEx:** `.pre-commit-config.yaml` (ruff + ruff-format), já há Makefile.
- **P3-02 releases:** versionamento semântico + `CHANGELOG.md` + tags/releases GitHub.
- **P1-04 backups (resto):** runbook já existe; falta **evidência de restore testado** e
  decisão de **object storage** (S3/R2) para uploads (volume Fly não tem PITR).

---

## 🧹 HOUSEKEEPING (working tree atual — não-commitado)
- 2 arquivos DELETADOS sem commit: `PLANO_CORRECAO_SESSAOINK.md` e
  `"AUDITORIA TÉCNICA PROFUNDA ... SESSÃOINK.MD"`. Decidir: commitar a remoção ou
  restaurar (`git checkout -- <arquivo>`).
- `HANDOFF_ANTIGRAVITY.md` e este `PLANO_FINALIZACAO_100.md` estão untracked —
  commitar se quiser versioná-los.
- Confirmar que **v32 reflete o último commit** `95e612c` (deploy ~02:45, commit 02:37 →
  provavelmente sim; validar com um `flyctl deploy` se houver dúvida, pois `/ready` está OK).

---

## 📋 ORDEM RECOMENDADA ATÉ 100%
1. **LGPD-1** (compliance — função existe, só falta o gatilho) — rápido e alto valor.
2. **P0-02 CSRF double-submit** (isolado, validar fluxo logado).
3. **Owner-check ARTISTA** + **OpenAPI/docs**.
4. **CSP** (isolado, testar visual).
5. **MVP flows + estados de UX** (por tela).
6. **P2/P3** (dashboards, pre-commit, releases, evidência de restore, object storage).

## CONTAGEM
- **Documento 1 (ORDEM):** P0 9/10 (falta P0-02) + P1 5/5 infra (LGPD precisa do gatilho
  LGPD-1) → faltam **~2 itens** (CSRF + ativar LGPD).
- **Documento 2 (AUDITORIA):** faltam **~9** (CSRF, CSP, OpenAPI/docs, fluxos MVP, estados
  UX, dashboards, pré-commit, releases, evidência de restore/object storage).
- **Segurança crítica:** ~95% pronta; os 2 itens da Prioridade 1 fecham o essencial.

> Regras: validar local antes de commit · push após commit · CI verde (5 jobs) ·
> deploy só com runtime alterado · `/ready` OK · atualizar `memory/hardening_p0_progress.md`.
> Itens de auth/CSRF/CSP/fluxos = ISOLAR e validar fluxo logado com o usuário.
