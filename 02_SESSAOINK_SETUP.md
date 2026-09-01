# 🎨 SESSÃOINK — SETUP DE SESSÃO (referência de qualidade do portfólio)

> **Instrução para o agente:** SessãoInk é o projeto com melhor higiene de engenharia do portfólio V-STACK — ele é o PILOTO do design system unificado. Execute em ordem, loop fechado. Pré-requisito: `00_VSTACK_BASE_SETUP.md` aplicado (inclusive o repositório `vstack-registry` criado).

## Contexto
- Stack: FastAPI + PostgreSQL / Next.js + TypeScript + Tailwind + shadcn/ui
- Papel estratégico: primeiro produto a consumir o `vstack-registry` e a fugir da "estética IA" genérica

## FASE 1 — Diagnóstico
1. Leia o repositório e o `CLAUDE.md` (crie se não existir).
2. Rode testes + lint e registre baseline.
3. Audite o frontend: liste componentes que são candidatos a serem EXTRAÍDOS para o `vstack-registry` (botões, cards, tabelas, empty states, dashboards).

✅ Verificar: lista de componentes candidatos documentada.

## FASE 2 — Conectar ao design system V-STACK
1. Confirme o shadcn MCP ativo (`/mcp`). Se não, siga https://ui.shadcn.com/docs/mcp
2. Instale as convenções do registry:
```bash
npx shadcn@latest add @github/Vvs2705/vstack-registry/design-conventions
```
3. Aplique o `DESIGN.md` como fonte de verdade: tokens de cor, tipografia, espaçamento e motion.
4. Camada estratégica de bibliotecas visuais (conforme plano de design existente):
   - Magic UI / 21st.dev / Reactbits — usar via copy-paste curado, NUNCA instalar tudo; cada componente adotado deve ser registrado no vstack-registry depois de adaptado aos tokens.

✅ Verificar: DESIGN.md presente no projeto e pelo menos 1 componente consumido do registry renderizando.

## FASE 3 — Motion de qualidade (anti "estética IA")
1. Instale as skills oficiais da GSAP para agentes: https://github.com/greensock/gsap-skills — siga o README para adicioná-las ao Claude Code.
2. Regra: microinterações e transições seguem os padrões da skill, não animações genéricas de fade-in em tudo.

✅ Verificar: skill GSAP listada e uma animação de exemplo implementada em um componente real.

## FASE 4 — Extração para o registry
Para cada componente maduro identificado na Fase 1:
1. Generalize (remova lógica de negócio do SessãoInk).
2. Adicione ao `vstack-registry` com entry no `registry.json` (type `registry:ui`, dependencies declaradas).
3. Substitua a versão local pela versão do registry: `npx shadcn@latest add @github/Vvs2705/vstack-registry/<componente>`

✅ Verificar: build do projeto passa consumindo os componentes do registry.

## FASE 5 — Qualidade contínua
1. `/ponytail-review` no diff antes de cada commit relevante.
2. Adicione a action `anthropics/claude-code-security-review` em `.github/workflows/`.

## FASE 6 — Registrar no CLAUDE.md
- Tooling ativo (shadcn MCP, GSAP skills, registry)
- Convenção: TODO componente visual novo nasce alinhado ao DESIGN.md; se for reutilizável, vai para o vstack-registry
- SessãoInk é referência: padrões daqui migram para os outros produtos

## Checklist final
- [ ] Baseline de testes/lint documentado
- [ ] design-conventions instalado do registry
- [ ] GSAP skills ativas
- [ ] ≥2 componentes extraídos para o vstack-registry
- [ ] CLAUDE.md atualizado
