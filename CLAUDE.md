# CLAUDE.md — SessãoInk

SaaS de gestão para tatuadores. **Referência de qualidade do portfólio V-STACK**: padrões daqui migram para os outros produtos.

## Stack

- **Backend:** FastAPI + PostgreSQL (SQLAlchemy async, Alembic) em `backend/`. Deploy: Fly.io.
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 3.4 em `frontend/`. Deploy: Vercel.

## Comandos

```bash
# Backend (env de teste: ENVIRONMENT=test SECRET_KEY=... REDIS_URL=... — ver .github/workflows/ci.yml)
cd backend && pytest -q && ruff check .

# Frontend (npm ci usa .npmrc com legacy-peer-deps, igual ao CI)
cd frontend && npm run check   # lint + typecheck + test + build
```

## Design system (fonte da verdade)

- **`frontend/DESIGN.md`** — instalado do registry (`@vstack/design-conventions`), é o brief de restrições anti-"estética IA". Regra de ouro: **zero cor/raio/sombra literal** — todo componente usa tokens semânticos.
- Tokens autorais em `frontend/src/styles/tokens.css` (teal/esmeralda `--si-accent`, grafite, porcelana; OKLCH sob `@supports`). Fontes: **Fraunces** (display) + **Outfit** (corpo) + **JetBrains Mono** — NÃO trocar por Inter/Geist; a identidade teal+serif é sancionada pelo DESIGN.md (SessãoInk = "Expressivo/criativo").
- Semânticos shadcn (`bg-background`, `text-primary`, `border-border`...) mapeados para os tokens autorais em `frontend/tailwind.config.js` — sem CSS var nova.
- `AJUSTES-DESIGN.md` (raiz, gitignorado) = notas locais de gap/prioridade por repo.

## Tooling ativo

- **shadcn/ui** — `frontend/components.json` (style base-nova, baseColor neutral, cssVariables). Adicionar componentes: `npx shadcn@latest add <item>`.
- **Registry V-STACK** — namespace `@vstack` → https://github.com/Vvs2705/vstack-registry (`r/*.json` buildados). Consumir: `npx shadcn@latest add @vstack/<componente>` (catálogo = `registry.json` do repo). Extraídos daqui: `currency-input`, `empty-state`, `search-modal`. Cache do raw.githubusercontent ~5min — se um item recém-publicado não chegar, usar a URL `r/<item>.json` pinada no SHA do commit.
- **GSAP skills** (oficiais greensock/gsap-skills) — em `.agents/skills/` (versionado) e `.claude/skills/` (local). Microinterações seguem os padrões das skills (`useGSAP` + scope + `gsap.matchMedia` para reduced-motion) — exemplo real em `frontend/src/components/PageGuide.tsx`. Nada de fade-in genérico em tudo; 1 efeito "statement" por tela.
- **Security scan (100% gratuito, padrão V-STACK)** — Semgrep bloqueante no CI (`p/security-audit` + `p/secrets` + packs por stack) + Dependabot por manifest (`/backend` pip, `/frontend` npm, actions). **NÃO usar** a action `anthropics/claude-code-security-review` nem `ANTHROPIC_API_KEY` (custo por PR). Falso-positivo: `# nosemgrep` bare na linha, só após confirmar benigno; achado real corrige na raiz.

## Convenções

1. **Todo componente visual novo nasce alinhado ao `frontend/DESIGN.md`** (tokens semânticos, tipografia autoral, reduced-motion respeitado).
2. **Se for reutilizável entre produtos, vai para o `vstack-registry`**: generalizar (remover lógica SessãoInk), adicionar entry no `registry.json` (type `registry:ui`, dependencies declaradas), `npx shadcn build --output r`, push, e consumir de volta via `@vstack/<nome>`. Candidatos mapeados em `docs/registry-candidatos.md`.
3. `/ponytail-review` no diff antes de commits relevantes.
4. Commits em `main` só via PR (CI bloqueante: pytest, pyright, eslint, tsc, build, gitleaks).

## Regra permanente — centralizar, nunca espalhar

- **JAMAIS criar pastas novas.** Tudo vai na estrutura que ja existe.
  So criar pasta nova em necessidade REAL e clara.
- **Trabalhar sempre na pasta central do projeto** — a raiz do repositorio, na
  branch `main`. Nada de copias, clones paralelos ou worktrees aninhados
  (`.claude/worktrees/...`, `.gemini/.../worktrees/...`).
- Terminou uma tarefa? O resultado volta para `main`, na pasta central.

### Git
- Trabalho so entra em `main` por **fast-forward** (`git merge --ff-only`).
  Se `main` divergiu, parar e perguntar — nao forcar.
- Branch ou worktree so e apagado depois de confirmado que esta 100% contido
  em `main` (`git merge-base --is-ancestor`).
- **Nunca** reescrever historico: proibido `git push --force`, `git filter-branch`,
  `git reflog expire`, `git gc --prune`, apagar `.git`.

### Higiene
- Regeneraveis podem ser apagados a vontade: `.next`, `dist`, `build`, `out`,
  `target`, `coverage`, `__pycache__`, `.pytest_cache`, `.turbo`,
  `*.tsbuildinfo`, `*.log`, `*.tmp`.
- Arquivo de trabalho — mesmo nao rastreado — nunca e apagado sem commit antes.
