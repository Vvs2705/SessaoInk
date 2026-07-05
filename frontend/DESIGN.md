---
# DESIGN.md — Fonte da verdade do design da V-STACK Solutions
# Padrão getdesign.md / Google Stitch (9 seções). Cole "@DESIGN.md" nos prompts do Claude Code.
# Valores extraídos do repositório real vstack-site (src/app/globals.css) em 01/07/2026 — NÃO inventados.
marca: V-STACK Solutions
versao: 1.0
atualizado_em: 2026-07-01
regra_de_ouro: "Zero cor/raio/sombra literal. Todo componente referencia um token semântico. Se aparecer text-gray-*, #hex avulso, rounded-2xl ou shadow-lg fora dos tokens → refatorar."
fonte_tokens: "src/app/globals.css do vstack-site (mesmos valores replicados aqui)"

tokens:
  accent:            "#e05e18"          # laranja — AÇÃO PRIMÁRIA (dark: #f07028)
  accent_light:      "#f07028"          # (dark: #ff8c48)
  accent_soft:       "#ffb270"
  accent_muted:      "rgba(224,94,24,0.10)"
  bg:                "#f6f7fb"          # fundo base   (dark: #0d1422)
  bg_deep:           "#eef1f7"          # fundo profundo (dark: #080e1a)
  bg_card:           "#ffffff"          # superfície/card (dark: #121b2c)
  text_1:            "#101522"          # texto principal (dark: #eef2ff)
  text_2:            "#526071"          # texto secundário (dark: #a7b1c4)
  text_3:            "#8b96a8"          # texto discreto (dark: #66758c)
  border:            "rgba(16,21,34,0.10)"
  border_hover:      "rgba(224,94,24,0.42)"
  destructive:       "oklch(0.577 0.245 27.325)"
  shadcn_base_color: "neutral"          # components.json baseColor
radius:
  sm: "8px"     # --radius-sm
  md: "12px"    # --radius-md / --radius-btn / shadcn --radius (0.75rem)
  card: "18px"  # --radius-card
  panel: "28px" # --radius-panel
sombra:
  sm:   "0 12px 32px rgba(16,21,34,0.08)"   # --shadow-sm
  base: "0 28px 80px rgba(16,21,34,0.14)"   # --shadow
  glow: "0 22px 70px rgba(224,94,24,0.18)"  # --shadow-glow (brilho do accent)
tipografia:
  display: "Syne"          # títulos (.font-display / var(--font-syne)) — peso 600–800, tracking negativo
  corpo:   "Geist"         # UI e texto (var(--font-sans)) — 16px base, line-height 1.6
  mono:    "JetBrains Mono" # código/dados (.font-mono)
  proibido: "Inter como fonte de headline (é o padrão estatístico do 'AI slop')"
fundacao_ui: "shadcn/ui (style base-nova, cssVariables:true, lucide-react). O código é seu — adaptar aos tokens acima, nunca deixar cor literal do template."
---

# DESIGN.md — V-STACK Solutions

> **Como um agente usa este arquivo:** em qualquer repositório da V-STACK, comece o prompt com
> *"Construa/ajuste X seguindo o @DESIGN.md exatamente"*. Este arquivo é o **brief de restrições** que
> impede o Claude Code de derivar para o visual genérico de IA. O detalhamento por repositório fica em
> `AJUSTES-DESIGN.md` (cada repo tem o seu).

## 1. Visual Theme (tema visual)
Ferramenta séria de tecnologia aplicada à operação — **não** landing genérica. Estética **escura, técnica e
organizada**, alto contraste, **laranja (`--accent`) como única cor de ação**, blocos bem espaçados.
Suporta light e dark (o site já entrega os dois). Densa, mas respirável: nada de card decorativo sem função,
nada de "sea of sameness" (fonte Inter + gradiente arroxeado + hero centralizado + 4 cards `rounded-2xl shadow-lg`).

**Espectro de expressividade por produto** (mesma marca, dosagem diferente):
- **Sóbrio / confiança** — FiscWise (contábil), ERP-V (fiscal), Fretamento (operacional): movimento mínimo, **sem Reactbits**, credibilidade acima de eye-candy.
- **Expressivo / criativo** — SessãoInk (tatuagem) e momentos-âncora do vstack: Reactbits/Magic UI liberados, **1 efeito "statement" por tela**.
- **Limpo / B2B** — Madeira Strema (paletes): confiável e direto, blocos de e-commerce/pricing (21st.dev), pouco floreio.

## 2. Color Palette (paleta)
Usar **somente** os tokens do frontmatter (que espelham `globals.css`). **Nunca** `text-gray-500`, `#hex`
avulso ou `bg-slate-*`. Ação = `--accent` (laranja). Hierarquia de texto = `--text-1/2/3`. Superfícies =
`--bg` / `--bg-deep` / `--bg-card`. Semânticos shadcn (`--background/--foreground/--primary/--muted/--border/--ring`)
mapeados via `@theme inline` (Tailwind 4). `baseColor: neutral`.

> ⚠️ **Dívida conhecida a limpar (não propagar):** no vstack, `.btn-primary` ainda carrega resíduos **ciano**
> (`rgba(0,180,216,…)`) de um accent antigo — inconsistente com o laranja. E `--text-primary/secondary/muted`
> estão **deprecated** (só vivos por causa de `ChatWidget.tsx`). Ao tocar, migrar para `--text-1/2/3` e trocar
> o ciano por `--accent`.

## 3. Typography (tipografia)
- **Display:** `Syne` (`.font-display`) — h1 `clamp(32px,5.5vw,56px)` peso 800 tracking `-0.025em`; h2 `clamp(24px,3.5vw,36px)` peso 700 `-0.02em`; h3 peso 600.
- **Corpo/UI:** `Geist` — 15–16px, line-height 1.6.
- **Mono:** `JetBrains Mono` para números/código/dados.
- **Eyebrow:** uppercase, `--accent`, tracking `0.18em`, peso 800, ~0.7rem.
- **Proibido:** Inter/Roboto default como headline. Usar a escala de tipo já definida em `globals.css` (não inventar nova escala por viewport).

## 4. Components (componentes)
Fundação **shadcn/ui** (`base-nova`, `cssVariables:true`, ícones `lucide-react`, `cn()` = clsx + tailwind-merge).
Primitivos da V-STACK (padrão do vstack): **`Container`**, **`Section`**, **`SectionHeader`** (eyebrow+título+descrição),
**`Surface`** (bloco/card), **`CTASection`**. Botões: `.btn-primary` (gradiente `--accent → --accent-light`),
`.btn-secondary`, `.btn-outline`. Card: `.card-vstack` (`--radius-card`, `--shadow-sm`).
**Evitar:** card dentro de card; gradiente decorativo em excesso; texto explicando a própria interface; CTA vago ("Saiba mais").

## 5. Layout
Ritmo de espaçamento base 8px. Largura máxima via `Container`. Seções via `Section`. Denso, porém arejado.
**Diagnóstico antes de venda:** CTA leva a entender o problema, não a prometer solução pronta. Sem card-in-card.

## 6. Depth (profundidade)
Somente via tokens de sombra: `--shadow-sm` (cards), `--shadow` (elevação forte), `--shadow-glow` (brilho do accent
em CTA primário). **Proibido** `shadow-lg`/`shadow-xl` avulsos do Tailwind. Bordas via `--border` / `--border-strong` / `--border-hover`.

## 7. Motion (movimento)
`framer-motion` (Motion). **Sempre** envolver a árvore com `<MotionConfig reducedMotion="user">` e respeitar
`prefers-reduced-motion` (o `globals.css` já zera animações nesse modo — manter). Reduzir bundle com `LazyMotion` + `m`
(~34KB → ~4.6KB). Reservar efeitos "statement" (Reactbits/Aurora/Ballpit) a **1 âncora por tela** e **nunca** em ERP/contábil.

## 8. Responsive rules
Mobile-first. Elementos fixos respeitam `100dvh`, largura disponível e safe-area (sem corte no mobile). Sem escala de
tipo baseada em `vw` inventada (usar a escala do `globals.css`). Checar preview desktop **e** mobile antes de publicar.

## 9. Agent prompt guide (como pedir ao Claude Code)
Template de prompt em qualquer repo:
> "Implemente/ajuste **[componente/tela]** seguindo o **@DESIGN.md** exatamente. Use **apenas tokens semânticos**
> (`--text-1/2/3`, `--accent`, `--bg-card`, `--border`, tokens de raio/sombra). **Zero cor literal** (`text-gray-*`,
> `#hex`, `rounded-2xl`, `shadow-lg`). Fontes: **Syne** (display), **Geist** (corpo). Instale UI via **shadcn**
> (registry compartilhado da V-STACK). Respeite `prefers-reduced-motion`. Não adicione feature nova antes de
> estabilizar a fundação visual."

**Benchmarks que reprovam a entrega (refatorar):**
- Fonte de headline ainda é Inter/Roboto default → ainda é "AI slop".
- Aparece `rounded-2xl`, `shadow-lg` ou `text-gray-*` fora dos tokens.
- Dois repositórios renderizam o "primário" com hex diferentes → o **registry compartilhado não está sendo consumido**.

---

## Ferramenta → papel (mapa de adoção)
| Ferramenta | Papel | Onde |
|---|---|---|
| **shadcn/ui** | Fundação (primitivos + tokens via CSS vars). Código seu, adaptado aos tokens. | **Todos** os frontends React/Next |
| **21st.dev** | Blocos de marketing/e-commerce (hero, pricing, features) via `npx shadcn add` | vstack (landings) · Strema (e-commerce) |
| **Magic UI** | Componentes animados (marquee, bento, bordered beam), companheiro do shadcn | vstack · landings · dashboards do Fretamento |
| **Reactbits** | "Statement pieces" (text/backgrounds Aurora/Ballpit) | Heros do vstack · SessãoInk. **Nunca** ERP/contábil |
| **getdesign.md / DESIGN.md** | Este arquivo — fonte da verdade anti-genérico | Todos os repos |

## Modelo de distribuição (uma fonte da verdade)
**Registry shadcn compartilhado** hospedado no vstack-site (ou num repo `vstack-ui`): um `registry.json` do qual
todos instalam via `npx shadcn add @vstack/<componente>`. Menos invasivo que monorepo para repos já separados.
Alternativa: `packages/ui` num monorepo Turborepo (o Fretamento já usa Turbo). Objetivo: "azul/laranja primário é o
**mesmo** em todo lugar" e nenhuma UI é reinventada por projeto.

## Disciplina de fonte
V-STACK **não usa Inter como headline**. Padrão: **Syne** (personalidade no título) + **Geist** (corpo neutro/preciso)
+ **JetBrains Mono** (dados). Propagar esse trio a todos os repos (hoje só o vstack o aplica formalmente).
