# CORREÇÃO MOBILE / RESPONSIVO + PostHog — Handoff de Frontend (Antigravity)

**Projeto:** SessãoInk · **Para:** agente de **Frontend (Antigravity)** · **Data:** 2026-06-02
**Agente de referência:** **AGENTE FRONTEND ECOMMERCE ENTERPRISE** (mobile-first, Core Web Vitals,
WCAG 2.2) — as diretrizes dele já estão resumidas no `CLAUDE.md` da raiz. **Use as habilidades dele.**

> Este documento foi escrito **após análise do código real** (não é genérico). Abaixo está o que JÁ
> foi corrigido (não refazer) e exatamente o que FALTA, com arquivos e evidência.

---

## 0. DIAGNÓSTICO (estado verificado em `main`)

O usuário relata: *"as telas precisam de zoom para ver as informações; não tem adaptação mobile correta."*
A análise confirma a causa e mostra que a correção anterior foi **parcial**:

### ✅ JÁ ESTÁ OK — NÃO REFAZER
- **Viewport** correto em `app/layout.tsx` (`width=device-width, initialScale=1, viewportFit=cover`).
  → O zoom **não** é problema de meta tag; é layout em densidade de desktop.
- **Navegação responsiva**: `Sidebar` é `hidden lg:flex` (some no mobile); `BottomNav` é `lg:hidden fixed bottom-0`
  (barra inferior só no mobile). `body` tem `overflow-x-hidden`; `main` tem `min-w-0`.
- **`configuracoes/page.tsx`** já foi adaptada (grids `grid-cols-1 md:grid-cols-2`, abas com `overflow-x-auto`).
  Foi o que o commit `01cac98` fez. **Não mexer de novo** (a não ser polimento pontual).
- **`atendimentos` e `estoque`**: tabelas dentro de `overflow-x-auto` (scroll lateral funciona — aceitável,
  mas dá pra melhorar com cards no mobile, ver §3).
- **PostHog**: **totalmente integrado no código** (`providers/PostHogProvider.tsx` + `lib/posthog.ts`). Só faltam
  as env vars (ver §4). **Não precisa de código novo.**

### ❌ O QUE FALTA (a causa real do zoom) — ~25 grids `grid-cols-N` SEM breakpoint
Grids multi-coluna fixos forçam 2–4 colunas em telas de 320–390px, espremendo cards/formulários a ponto de
exigir zoom. Concentração (mais afetados primeiro):

| Arquivo | Sintoma |
|---|---|
| `(dashboard)/financeiro/page.tsx` | vários `grid grid-cols-2/3 gap-4` em **cards de resumo e formulários/modais** (ex.: linhas ~1042, 1090, 1135, 1169, 1198, 1231, 1326). A tabela já é `hidden lg:block`, mas os forms/stats não colapsam. |
| `(dashboard)/page.tsx` (dashboard) | grids de cards financeiros/operacionais e gráficos sem breakpoint. |
| `(dashboard)/portfolio/page.tsx` | grade de imagens e filtros com colunas fixas. |
| `(dashboard)/flash-arts/page.tsx` | grade de cards + `w-[120px]` fixo (linha ~293). |
| `atendimentos/DetalhesAtendimentoModal.tsx` | `grid-cols-2/3` dentro de modal (muito apertado no mobile). |
| `relatorios`, `documentos`, `clientes`, `atendimentos`, `agenda` (`[id]` incluídos) | grids 2–4 colunas pontuais. |

---

## 1. FRONTEIRAS (obrigatórias)
1. **Só edite `frontend/`.** Não toque em `backend/`, `docs/`, migrações, `*.md` de planejamento.
2. `git pull --rebase origin main` antes de começar e antes de cada push.
3. Commits pequenos, PT-BR, prefixo `fix(frontend):` / `feat(frontend):`, terminando com
   `Co-Authored-By: Antigravity <noreply@google.com>`.
4. **Gate antes de commitar:** `cd frontend && npm run tsc && npm run build` (tsc=0 e build OK).
5. Não definir `NEXT_PUBLIC_API_URL` (ausência habilita o proxy same-origin). CSP `img-src 'self'` continua valendo.

---

## 2. PADRÃO DE CORREÇÃO (receita) — aplique tela a tela

### 2.1 Grids responsivos (o principal)
Trocar todo `grid-cols-N` "cru" por escala mobile-first. Regra geral:
- **Cards de estatística / KPI:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (ou `xl:grid-cols-4` para 4+).
- **Campos de formulário lado a lado:** `grid grid-cols-1 sm:grid-cols-2` (no mobile empilha).
- **Grade de imagens (portfólio/flash):** `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (2 colunas no celular é OK p/ thumbnail; o problema é 3–4 colunas a partir de 320px).
- **Dentro de modais:** prefira `grid-cols-1` no mobile (`grid-cols-1 sm:grid-cols-2`), pois o modal já é estreito.

> Critério: a partir de **320px** nenhum grid deve ter mais de 1–2 colunas se isso quebrar a leitura.

### 2.2 Tabelas
Onde houver `<table>`/`overflow-x-auto` que ainda fica ruim no celular, use **um dos dois**:
- **Cards no mobile:** `hidden lg:block` na `<table>` + um bloco `lg:hidden` com cards (1 por linha). É o padrão que o `financeiro` já usa para a tabela — replicar onde fizer sentido.
- **Scroll lateral aceitável:** manter `overflow-x-auto` num wrapper, mas garantir que a tabela tenha `min-w-` só o necessário e que a página NÃO ganhe scroll horizontal (o scroll fica no container da tabela, não no `body`).

### 2.3 Tipografia e densidade
- Evitar textos `text-[10px]`/`text-xs` em conteúdo importante no mobile; usar fluido quando fizer sentido (`text-sm sm:text-base`, ou `clamp()` via classe util).
- Padding responsivo: `p-4 sm:p-6` em vez de `p-6` cravado, para não comer largura no celular.

### 2.4 Alvos de toque (WCAG 2.2 / CLAUDE.md)
- Botões/itens clicáveis no mobile ≥ **44×44px** (`min-h-[44px]`, padding adequado). Atenção a ícones-botão pequenos.

### 2.5 Larguras fixas
- Trocar `w-[120px]` (flash-arts) e similares por largura flexível/`max-w-*` quando estiver em layout principal.

---

## 3. ORDEM RECOMENDADA (por impacto)
1. **`financeiro/page.tsx`** — mais usada e mais afetada (forms/stats/modais).
2. **`(dashboard)/page.tsx`** (dashboard executivo) — cards e gráficos.
3. **`portfolio`** e **`flash-arts`** — grades de imagem + `w-[120px]`.
4. **`atendimentos/DetalhesAtendimentoModal.tsx`** e modais em geral.
5. **`relatorios`, `clientes`, `documentos`, `atendimentos`, `agenda`** — grids pontuais.
6. **Polir tabelas** de `atendimentos`/`estoque` (cards no mobile, se sobrar tempo).

---

## 4. PostHog — só env vars na Vercel (código já pronto)
O código já inicializa o PostHog com `NEXT_PUBLIC_POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_HOST`
(`lib/posthog.ts`; faz no-op sem a key; já opta-out em `development`). **Basta** adicionar na Vercel
(Project → Settings → Environment Variables, escopo Production):

```
NEXT_PUBLIC_POSTHOG_KEY  = phc_nY377Rpixon9KJsh4a43cAs5kXfZPVmNpbcpQiviJamr
NEXT_PUBLIC_POSTHOG_HOST = https://us.i.posthog.com
```

(Projeto PostHog: **SessaoInk**, US cloud.) Depois, um redeploy da Vercel ativa o tracking de `$pageview`.
Nenhuma mudança de código necessária.

---

## 5. CRITÉRIOS DE ACEITE (Definition of Done)
- [ ] Em **320px, 375px e 414px** (DevTools → modo dispositivo): **nenhuma página** tem scroll horizontal no `body`
      e **nenhuma informação exige pinch-to-zoom** para ler.
- [ ] Grids listados no §0 colapsam corretamente (1–2 colunas no celular).
- [ ] Modais legíveis no mobile (campos empilhados).
- [ ] Alvos de toque ≥ 44px nas ações principais.
- [ ] `npm run tsc` = 0 e `npm run build` OK antes de cada push.
- [ ] PostHog: 2 env vars setadas na Vercel + redeploy (validar evento `$pageview` chegando no painel).

### Como validar rápido
`cd frontend && npm run dev` → abrir cada tela no DevTools (dispositivo iPhone SE / 360px) → conferir
ausência de scroll horizontal e leitura sem zoom. Priorizar `financeiro`, dashboard, `portfolio`, `flash-arts`.

---

## 6. CONTEXTO BACKEND (não precisa mexer — só referência)
Backend, MFA, Mercado Pago (webhook validado, **cobrança real OFF**), Sentry e R2 já estão **prontos e em
produção** (Fly v43). Os contratos de API que estas telas consomem não vão mudar. Foque 100% no visual/mobile.
