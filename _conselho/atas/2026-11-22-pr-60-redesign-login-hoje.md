# Ata do Conselho — PR #60: redesign do login, tela "Hoje" e status agrupados

- **Data:** 2026-11-22
- **Modo:** B
- **Projeto / repositório:** Vvs2705/SessaoInk · **PR:** #60
- **Pedido literal:** "sessão ink tbm refazer animação de login, disposição das informações, tudo que for necessario".
- **Estado:** APROVADA

## 1. Triagem
SEGUIR: só `frontend/`; lógica de auth, API, enums, backend e dependências sem mudança. O merge publica o frontend em produção
na Vercel (confirmado pelo dono em 2026-11-22: "Sim, Conselho e merge").

## 2–4. Pareceres (independentes)
- Ciclo 1 (47e985f): produtor APROVOU. Produto VETOU — faixa compacta do login (celular) mostrava o resumo de exemplo sem o selo
  "Exemplo" (`frontend/src/components/auth/LoginArt.tsx`). Técnico VETOU — B1: `tailwind.config.js` não varria `src/lib`, então as
  classes dos chips de `lib/status-atendimento.ts` não entravam no CSS de produção; B2: a tela Hoje filtrava o alerta
  `SINAL_PENDENTE`, que vem dos lançamentos do financeiro e a fila não cobre.
- Ciclo 2 (21ba143): selo "Exemplo" no compact; `content` do Tailwind varre `src/lib` (4 classes conferidas no CSS do build);
  `alertasVisiveis()` em `lib/acoes-do-dia.ts` filtra só `ORCAMENTO_PARADO`, com teste. Extras com teste: `formatDuracao`,
  telefone com 0 na frente, EM_ATENDIMENTO só destaca se for de hoje. Técnico rodou `npm run check` em cópia isolada: exit 0,
  48 testes; CI 12/12 verde.
- Não bloqueantes (follow-up): `GET /api/v1/atendimentos/` sem paginação agora roda em toda página (selo do menu); possível item
  duplicado na fila (cobrar sinal + alerta do financeiro); REAGENDADO sem ação na fila; mensagem de WhatsApp de EM_ANALISE;
  data abreviada na mensagem ao cliente; urgência sem texto visível; "20 min previstas"; EM_ATENDIMENTO sem data; cadastro e
  esqueci-senha com visual antigo; e2e não rodado; smoke da tela Hoje com conta real depois do deploy.

## 6. Votos (Modo B — revisão do PR)
Commit revisado: 21ba1433dbf1f2e0670468d3122f2267d85a3752

| Diretor | Voto | Motivo / evidência |
|---|---|---|
| diretor-tecnico | APROVA | B1 e B2 corrigidos e conferidos no CSS do build e nos testes; npm run check exit 0 (48 testes); CI 12/12 |
| diretor-produto | APROVA | selo "Exemplo" no login do celular; hierarquia "o que faço agora" antes dos números |
| produtor | APROVA | delta de 5 arquivos só em frontend atende os vetos; CI 12/12 verde |

**Veredito final:** APROVADO
