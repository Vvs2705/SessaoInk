# FINALIZAÇÕES NECESSÁRIAS — Handoff de Frontend (Antigravity)

**Projeto:** SessãoInk — SaaS de gestão para estúdios de tatuagem
**Data:** 2026-06-02
**Para:** agente de **Frontend (Antigravity)**
**Contexto:** o backend das fases recentes (Financeiro, Dashboard, MFA, Mercado Pago) está
**100% pronto, no `main`, com CI verde e deployado em produção (Fly v41)**. O que falta é o
**frontend** que consome esses contratos + alguns refinamentos. Este documento é a **fonte única**
de continuidade; os handoffs/planos antigos foram removidos.

---

## 0. REGRAS DE FRONTEIRA (obrigatórias)

1. **Só edite arquivos dentro de `frontend/`.** NÃO toque em `backend/`, `docs/`, migrações,
   `*.md` de planejamento, nem em `docs/openapi.json`.
2. Antes de começar e antes de cada `git push`: `git pull --rebase origin main`.
3. Commits pequenos e focados, mensagem PT-BR, prefixo `feat(frontend):` / `fix(frontend):`,
   terminando com `Co-Authored-By: Antigravity <noreply@google.com>`.
4. **Gate antes de commitar:** `cd frontend && npm run -s tsc && npm run -s build` — só comite
   com **tsc=0 e build OK**.
5. **NUNCA** defina `NEXT_PUBLIC_API_URL` (a ausência dela habilita o modo proxy same-origin).

## 1. ARQUITETURA QUE VOCÊ PRECISA RESPEITAR

- Next.js 15 (App Router) na Vercel; backend FastAPI no Fly (`sessaoink-api`).
- **Proxy same-origin:** o browser fala com `/api/v1/...` (mesmo domínio); o
  `frontend/src/app/api/v1/[...path]/route.ts` encaminha pro backend. **Nunca** chame o domínio
  do backend direto do browser.
- **CSP `img-src 'self'`:** TODA imagem vem de URL relativa same-origin (`/api/v1/...`). O QR Code
  do MFA é exceção amigável: vem como **data URI base64** (`data:image/png;base64,...`) — pode ir
  direto no `<img src>` sem violar a CSP (revisar a CSP se bloquear `data:`; preferir `img-src 'self' data:`).
- **Cookies httpOnly + CSRF double-submit:** o login/refresh setam `csrf_token` (não-HttpOnly).
  O client de API já deve injetar `X-CSRF-Token` nas mutações (confira `src/lib/api/client.ts`).
  Endpoints novos seguem a mesma regra — **exceto** os de MFA pré-sessão (ver §2.3).

## 2. FASE F1 — MFA (TOTP + e-mail OTP) [PRIORIDADE ALTA]

Backend pronto. Objetivo: (a) tela de configuração nas **Configurações**; (b) etapa de 2º fator no **login**.

### 2.1 Contratos — Configuração (usuário autenticado)
- `POST /api/v1/auth/mfa/totp/setup` → `200 { secret, otpauth_uri, qr_code }`
  - `qr_code` é um **data URI PNG** (renderize em `<img src={qr_code} />`). `secret` é o fallback
    manual (mostrar em fonte mono para digitar no app autenticador).
- `POST /api/v1/auth/mfa/totp/ativar` body `{ codigo }` → `204` (400 se código inválido).
- `POST /api/v1/auth/mfa/totp/desativar` body `{ senha }` → `204` (exige a senha do usuário).
- `POST /api/v1/auth/mfa/email/ativar` → `200 { mfa_email_ativo: true }`.
- `POST /api/v1/auth/mfa/email/desativar` body `{ senha }` → `200 { mfa_email_ativo: false }`.
- `GET /api/v1/auth/me` agora retorna também `mfa_totp_ativo` e `mfa_email_ativo` (use para o estado dos toggles).

### 2.2 Contratos — Login com 2º fator
- `POST /api/v1/auth/login` body `{ email, senha }` → `200`:
  - **Sem MFA:** `{ message, token_type, mfa_required: false }` — sessão já emitida (cookies setados).
  - **Com MFA:** `{ mfa_required: true, metodos: ["totp"|"email"...], desafio: "<token>" }` —
    **nenhum cookie é setado**. Guarde `desafio` em memória (não em localStorage) e mostre a etapa de 2º fator.
- `POST /api/v1/auth/mfa/email/solicitar` body `{ desafio }` → `202` (envia o código por e-mail).
- `POST /api/v1/auth/mfa/verificar` body `{ desafio, codigo, metodo }` (`metodo` = `"totp"` ou `"email"`)
  → `200 { mfa_required: false }` e **seta os cookies de sessão** (mesma resposta do login direto).
  - 400 = código inválido; 401 = desafio expirado (>5 min) → voltar ao passo de senha.

### 2.3 Detalhes importantes
- `/mfa/verificar` e `/mfa/email/solicitar` são **isentos de CSRF** no backend (ocorrem antes da
  sessão existir). O resto dos endpoints MFA segue o fluxo autenticado normal (com `X-CSRF-Token`).
- O `desafio` é de uso único e expira em 5 min. O OTP de e-mail também (TTL 5 min, rate limit de 5 envios).
- Fluxo de UX sugerido no login: senha → se `mfa_required`, tela "Verificação em duas etapas" com
  campo de 6 dígitos; se `metodos` inclui `email`, botão "Enviar código por e-mail" (chama `solicitar`);
  se inclui `totp`, instrução "abra seu app autenticador". Selo de método ativo.

### 2.4 Definition of Done (F1)
- [ ] Em Configurações: ativar/desativar TOTP (com QR + confirmação por código) e e-mail OTP.
- [ ] `/me` reflete o estado e os toggles ficam consistentes após reload.
- [ ] Login de usuário com MFA mostra etapa de 2º fator e conclui com TOTP **e** com e-mail OTP.
- [ ] Erros tratados (código errado, desafio expirado, rate limit 429 no envio de e-mail).
- [ ] Estados de loading/disabled; nada de credenciais ou `desafio` em localStorage.

## 3. FASE F2 — Assinatura / Checkout (Mercado Pago) [PRIORIDADE ALTA]

Backend pronto, mas **cobrança real está TRANCADA** por `PAGAMENTOS_GO_LIVE` (hoje `false`).
O frontend deve funcionar e degradar com elegância enquanto o go-live não é ligado.

### 3.1 Contratos
- `GET /api/v1/public/planos` → catálogo público (já existe; usado na página `/precos`). Cada plano traz
  `tabela_precos` por ciclo: `{ ciclo, label, meses, preco_cheio, pix_total, desconto_pix_pct,
  cartao_total, cartao_max_parcelas, cartao_parcela, cartao_juros, cartao_modo, obs }`.
- `GET /api/v1/pagamentos/config` → `{ gateway: "mercadopago", public_key, go_live }` (autenticado).
- `POST /api/v1/pagamentos/checkout` body `{ plano_slug, ciclo, email? }` (ADMIN) →
  - `201 { tipo, id, init_point }` → **redirecionar** o usuário para `init_point` (checkout do MP).
  - `503` enquanto `go_live=false` → mostrar "Pagamento em configuração / disponível em breve".
  - `ciclo` ∈ `mensal|trimestral|semestral|anual`. `mensal` = assinatura recorrente; demais = cobrança única.

### 3.2 Definition of Done (F2)
- [ ] Tela de assinatura (Configurações ou `/precos` logado): seletor de ciclo, resumo do preço
      (Pix vs cartão/parcelas a partir de `tabela_precos`), botão "Assinar".
- [ ] Se `config.go_live=false` → botão desabilitado + aviso claro (sem erro feio).
- [ ] Se `go_live=true` → `checkout` e redirect para `init_point`; tratar 502/503.
- [ ] Páginas de retorno `?pagamento=sucesso|pendente|falha` e `?assinatura=ok` (o backend usa essas
      query strings no `back_urls`): mostrar feedback e atualizar status da assinatura.

## 4. FASE F3 — Polir Financeiro & Dashboard [PRIORIDADE MÉDIA]

O frontend de Financeiro e Dashboard **já existe** (`frontend/src/app/(dashboard)/financeiro/page.tsx`
e `.../page.tsx`), consumindo os contratos abaixo. Falta **validar no browser** e refinar.

### 4.1 Contratos (referência)
- `GET /api/v1/financeiro/consolidado?inicio=YYYY-MM-DD&fim=YYYY-MM-DD` →
  `{ resumo:{ entradas_pagas, entradas_pendentes, saidas_pagas, saidas_pendentes, saldo_realizado,
  saldo_previsto, sinais_pagos, sinais_pendentes, comissoes_pagas, comissoes_pendentes, lucro_estimado },
  graficos:{ por_categoria[], por_artista[], fluxo_diario[] } }`.
- Listas: `GET /api/v1/financeiro/{entradas|saidas|comissoes|reservas}`; CRUD em `/financeiro/`
  (filtros `?tipo&status&categoria&artista_id&data_inicio&data_fim`); comissões
  `POST /financeiro/comissoes/gerar` e `PATCH /financeiro/comissoes/{id}/pagar`;
  exportação `GET /financeiro/exportar` (CSV, `Content-Disposition` attachment).
- `GET /api/v1/dashboard/resumo?inicio&fim` → `{ periodo, financeiro{...,ticket_medio},
  operacional{ orcamentos_pendentes, sessoes_hoje, sessoes_sete_dias, aguardando_sinal,
  clientes_novos, conversao_orcamento_sessao }, graficos{ fluxo_diario, por_artista, por_metodo,
  por_categoria }, alertas[ { tipo, mensagem, link } ] }`.

### 4.2 Profundidade / qualidade esperada
- **Dashboard:** cards financeiros grandes na linha 1; operacionais menores na linha 2; gráficos com
  legenda (fluxo diário, receita por artista, despesa por categoria, receita por método); linha de
  **alertas** clicáveis (cada alerta tem `link` → navegar). Cores: verde=entrada, vermelho=saída,
  amarelo=pendente, azul=agenda, roxo=comissão.
- **Financeiro:** tabs (entradas/saídas/comissões/reservas), filtros no topo (período, categoria,
  artista, status), cards de consolidado, modais de criação (entrada/saída/comissão/reserva),
  botão exportar CSV, ação "gerar comissões" e "pagar comissão".
- **Transversal:** estado vazio profissional, **skeleton** no carregamento, cards clicáveis, formatação
  de moeda BRL e datas pt-BR, sem números quebrando layout.

### 4.3 Definition of Done (F3)
- [ ] Dashboard e Financeiro validados **no browser** (logado, via proxy) sem erro de console/rede.
- [ ] Gráficos renderizam com dados reais; estados vazios e skeletons presentes.
- [ ] Exportação CSV baixa o arquivo; modais salvam e atualizam as listas/consolidado.

## 5. FASE F4 — Outras áreas [PRIORIDADE BAIXA / INCREMENTAL]

(herdado do plano antigo, ainda não feito — só após F1–F3)
- **Relatórios expandidos:** financeiro mensal, receita por artista, despesas por categoria,
  comissões, conversão, orçamentos por origem, recorrentes, ticket médio, sinais pendentes, agenda futura.
  (Boa parte já tem dados no `/dashboard/resumo` e `/financeiro/*`; faltam telas dedicadas.)
- **Permissões finas no frontend:** ocultar/disable ações conforme papel —
  ADMIN (tudo); ARTISTA (próprios atendimentos/comissões, sem exclusão financeira/permanente);
  RECEPCIONISTA (cliente/agenda/orçamento, sem lucro consolidado se vetado). O backend já aplica
  RBAC via `require_role`; o frontend deve **espelhar** para não mostrar botão que retorna 403.

## 6. BARRA DE QUALIDADE (Definition of Done global)

- **Zero fake:** nenhuma página/botão mockado, `href="#"`, `onClick` vazio, "em breve" sem função,
  ou dado hardcoded. Tudo consome a API real via proxy.
- **Same-origin & CSP:** nenhuma chamada ao domínio do backend no browser; imagens via `/api/v1/...`
  (ou `data:` para o QR do MFA).
- **A11y:** foco visível, labels, navegação por teclado nos modais e na etapa de MFA.
- **Resiliência:** tratar 401 (sessão expirada → login), 403 (sem permissão → esconder ação),
  429 (rate limit → aviso), 5xx (erro amigável + retry quando fizer sentido).
- **Gate verde:** `tsc` 0 erros + `next build` OK antes de cada push. Deploy Vercel é automático no `main`.
- **Identidade visual:** cores `#050B12` / `#0B171C` / `#F0EADD` / `#2F9285` / `#C36B3F` / `#87938F`
  / `#E35D5B`; raios `rounded-[14px]` / `rounded-[18px]`.

## 7. ORDEM RECOMENDADA

1. **F1 — MFA** (configuração + login com 2º fator).
2. **F2 — Assinatura/Checkout** (degrada com `go_live=false`).
3. **F3 — Validar e polir Financeiro/Dashboard** no browser.
4. **F4 — Relatórios e permissões finas** (incremental).

> Itens que dependem do dono do produto (NÃO bloqueiam o frontend): ligar `PAGAMENTOS_GO_LIVE=true`
> + `MERCADO_PAGO_WEBHOOK_SECRET` para cobrança real; credenciais R2; PITR no Neon; PostHog/Sentry.
