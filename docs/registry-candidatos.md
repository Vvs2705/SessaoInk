# Registry V-STACK — baseline e candidatos a extração (2026-07-03)

## Baseline (antes do design system)

| Área | Comando | Resultado |
|---|---|---|
| Backend testes | `pytest -q` (env de CI) | **221 passed** |
| Backend lint | `ruff check .` | **limpo** |
| Frontend lint | `npm run lint` | **0 erros**, 116 warnings (react-hooks, advisory) |
| Frontend testes | `vitest run` | **14 passed** (2 files) |

## Componentes candidatos a extração p/ `vstack-registry`

| Componente | Path | Acoplamento | Maturidade | Generalização necessária |
|---|---|---|---|---|
| **EmptyState** | `frontend/src/components/ui/empty-state.tsx` | baixo | 5/5 | nenhuma (Lottie opcional) |
| **CurrencyInput** | `frontend/src/components/ui/CurrencyInput.tsx` | baixo | 5/5 | nenhuma (máscara BRL isolada em utils) |
| **BrandLogo** | `frontend/src/components/BrandLogo.tsx` | baixo | 5/5 | src da imagem via prop |
| PageGuide | `frontend/src/components/PageGuide.tsx` | médio | 4/5 | receber guia via prop (hoje `resolveGuide(pathname)`) |
| BuscaModal → SearchModal | `frontend/src/components/BuscaModal.tsx` | médio-alto | 4/5 | tipos/ícones/href/busca via config+callbacks |
| Sidebar | `frontend/src/components/layout/Sidebar.tsx` | médio | 4/5 | `navItems`/`userRole`/`onLogout` via props (remover `useRole`) |
| BottomNav | `frontend/src/components/layout/BottomNav.tsx` | médio | 4/5 | idem Sidebar |
| MfaEnforcementGate | `frontend/src/components/MfaEnforcementGate.tsx` | alto | 3/5 | carência/role/query via props |
| AuthMarketingPanel | `frontend/src/components/auth/AuthMarketingPanel.tsx` | alto | 3/5 | conteúdo via children |
| DailyTattooLoginAnimation / TattooLoginIllustration | `frontend/src/components/auth/` | 100% SessãoInk | 1/5 | **não extrair** (identidade do produto) |

**Top 3 extração imediata:** CurrencyInput, EmptyState, BrandLogo.

## Estado do stack (verificado)

- Next 15 (App Router) + React 19 RC + Tailwind **3.4** (tokens em `src/styles/tokens.css`, mapeados no `tailwind.config.js`).
- shadcn/ui **não instalado** (sem `components.json`), mas fundação pronta: `cn()`, cva, tailwind-merge, lucide-react já nas deps.
- Fontes autorais: Fraunces (display) + Outfit (corpo) + JetBrains Mono — sancionadas pelo DESIGN.md (SessãoInk = "Expressivo/criativo", paleta teal própria; ver `AJUSTES-DESIGN.md`).
- Motion: só CSS até agora; gsap não instalado (entra na Fase 3 do setup).
