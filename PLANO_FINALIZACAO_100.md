# PLANO DE FINALIZACAO ATE 100% - SessaoInk

> Fonte unica de verdade desde 2026-06-01. O plano antigo
> `PLANO_CORRECAO_SESSAOINK.md` foi removido do repositorio e nao deve ser
> usado para retomadas.

---

## JA CONCLUIDO E VERIFICADO

Estado confirmado em 2026-06-01:

- GitHub `main` em `41039a9` (`fix: corrigir connect-src em producao`).
- CI verde no run `26767041667`: Backend, Frontend, Migrations, Secret Scan,
  Security Scan e Docker/SBOM.
- Backend Fly `sessaoink-api` em producao, machine version 33, `/ready` OK:
  `{"status":"ready","checks":{"database":"ok","redis":"ok"}}`.
- Frontend Vercel em producao, deploy mais recente `sessao-5pgnru5o5...`
  Ready, dominio publico `https://sessao-ink.vercel.app` respondendo 307 para
  `/login?from=%2F`.
- CSP publico confirmado sem `unsafe-eval` e com `connect-src` apontando para
  `https://sessaoink-api.fly.dev`, sem fallback para localhost.

Itens fechados nesta rodada:

- LGPD-1: endpoint admin + workflow GitHub Action + testes + auditoria
  `lgpd.anonymized`.
- P0-02 parcial/rollout seguro: CSRF double-submit tolerante com cookie,
  header no frontend e testes.
- P1-03: `backend/openapi.json`, `docs/api.md`, script e gate de CI.
- P0-03 incremental: owner-check granular para ARTISTA em agenda,
  atendimentos, portfolio e flash.
- P1-07 primeira etapa: removido `unsafe-eval` do CSP; `unsafe-inline` de script
  e style ainda ficam para a etapa com nonce/hash.
- DevEx inicial: `.pre-commit-config.yaml`, `CHANGELOG.md`, template de release
  e handoff curto para o Antigravity.
- Housekeeping: documentos antigos removidos e plano final versionado.

Commits relevantes:

- `9493fbc` - `feat: concluir hardening LGPD CSRF e contratos`
- `2685c5a` - `fix: estabilizar gates de CI`
- `585b8d1` - `fix: normalizar ordem do schema OpenAPI`
- `80d8a96` - `fix: endurecer CSP do frontend`
- `41039a9` - `fix: corrigir connect-src em producao`

---

## BLOQUEIO OPERACIONAL CONHECIDO

### LGPD workflow ainda nao operacional

O codigo e o deploy estao prontos, mas o dry-run manual do workflow falhou em
`Validar secrets obrigatorios` porque o repositorio possui apenas
`NEON_API_KEY`.

Secrets faltantes no GitHub:

- `SESSAOINK_ADMIN_EMAIL`
- `SESSAOINK_ADMIN_PASSWORD`

Aceite pendente:

- Configurar os secrets acima ou trocar o workflow para token de servico.
- Rodar `LGPD Retention` com `dry_run=true` e confirmar sucesso.
- Depois rodar sem `dry_run` apenas quando o usuario confirmar que pode tocar
  dados reais.

---

## O QUE FALTA PARA 100%

### Prioridade 1 - Seguranca / Compliance

#### CSRF strict mode

Estado atual: modo tolerante em producao para nao quebrar sessoes existentes.

Proximo passo:

1. Validar fluxo logado real em producao: login, criar/editar cliente, agenda,
   atendimento, financeiro, documentos, portfolio/flash e logout.
2. Confirmar que todas as mutacoes enviam `X-CSRF-Token`.
3. Alterar middleware para modo estrito em POST/PUT/PATCH/DELETE autenticado.
4. Validar local, commit, push, CI verde e deploy se necessario.

Aceite:

- Mutacao autenticada sem header valido retorna 403.
- GET/HEAD e endpoints publicos continuam isentos.
- Fluxo logado real continua funcional.

### Prioridade 2 - Hardening

#### CSP com nonce/hash

Estado atual:

- `unsafe-eval` removido.
- `script-src 'unsafe-inline'` ainda presente.
- `style-src 'unsafe-inline'` ainda presente por compatibilidade.

Proximo passo:

1. Migrar scripts inline para nonce/hash.
2. Testar Next.js 15, Sentry e PostHog em runtime real.
3. Remover `script-src 'unsafe-inline'`.
4. Manter `style-src 'unsafe-inline'` somente se ainda necessario.

Aceite:

- App sem erros CSP no console.
- Build e CI verdes.
- Header publico sem `unsafe-eval` e sem `script-src 'unsafe-inline'`.

### Prioridade 3 - Produto / MVP

#### MVP-1 - Fluxos funcionais e estados de UX

Validar e completar por tela:

- Autenticacao.
- Clientes.
- Agenda, incluindo conflito de horario.
- Atendimentos e `/atendimentos/[id]`.
- Financeiro, incluindo pago/estorno.
- Documentos, aceite e auditoria.
- Portfolio/flash, publicar/despublicar.
- Portal publico, orcamento, rate limit, anti-spam e validacao.

Estados obrigatorios por tela:

- Carregando.
- Vazio.
- Erro.
- Sucesso.
- Sem permissao.

Aceite:

- UI funcional.
- Validacao backend coerente.
- Erro amigavel.
- Smoke E2E minimo por fluxo.

### Prioridade 4 - Observabilidade / DevEx

- P2-01 dashboards: eventos PostHog para registro, login, lead, orcamento,
  atendimento, pagamento e documento aceito.
- Alertas Sentry: 5xx, `/ready` 503, latencia e pico de login.
- P2-04 docs: complementar `docs/architecture.md` se necessario.
- P3-02 releases: criar tag/release GitHub quando o usuario autorizar.
- P1-04 backups: registrar evidencia de restore testado.
- P1-04 uploads: decidir object storage (S3/R2) para arquivos; volume Fly nao
  entrega PITR para uploads.

---

## ORDEM RECOMENDADA A PARTIR DE AGORA

1. Configurar os secrets do workflow LGPD e rodar dry-run.
2. Validar fluxo logado real e fechar CSRF strict mode.
3. Isolar CSP nonce/hash e remover `script-src 'unsafe-inline'`.
4. Executar MVP-1 por telas, com smoke E2E minimo.
5. Fechar observabilidade, restore testado e decisao de object storage.

## REGRAS DE EXECUCAO

- Validar local antes de commit.
- Push apos commit.
- Confirmar CI verde.
- Deploy backend apenas quando runtime/backend/migration mudar.
- Confirmar `/ready` apos deploy backend.
- Itens de auth, dados reais, pagamento ou deploy exigem confirmacao do usuario
  antes de tocar producao.
