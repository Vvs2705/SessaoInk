# PLANO DE MELHORIAS — DASHBOARD, FINANCEIRO, PORTFÓLIO E USABILIDADE GERAL

**Projeto:** SessãoInk
**Data:** 01/06/2026
**Origem:** feedback de tatuador usando o sistema em produção.
**Objetivo:** transformar o projeto em um sistema mais completo, funcional, profissional e claro para operação diária de um estúdio de tatuagem.

---

## 1. Diagnóstico direto

Estrutura funcional já existe (portfólio, financeiro, dashboard, atendimentos, clientes, portal público). Gargalos principais:

1. Portfólio tem `DELETE /api/v1/portfolio/{id}` (soft delete), mas o frontend não expõe exclusão real — o `deleteMutation` apenas torna privado via PATCH de visibilidade.
2. Dashboard inicial simples demais — falta visão executiva (entrada/saída/saldo, reservas, comissões, pendências, agenda futura, conversão, alertas).
3. Financeiro tem base (ENTRADA/SAIDA/COMISSAO/SINAL + status + forma de pagamento), mas falta categoria, centro de custo, reserva, comissão por artista, consolidado e filtros.
4. Resumo financeiro atual limitado (receita_mes, sinais_pendentes, ticket_medio).
5. Frontend financeiro precisa de clareza, filtros, consolidação e gráficos.
6. Padronizar "excluir / arquivar / ocultar / deletar permanentemente".

---

## 2. P0 — Exclusão real de arquivos do portfólio

### Níveis
- **Arquivar** (padrão): `DELETE /api/v1/portfolio/{id}` (soft delete, `ativo=False`); some da listagem e do portal; arquivo físico pode permanecer.
- **Excluir permanentemente** (admin): remove registro + arquivo físico + log de auditoria; bloquear se vinculado a termo/atendimento que exija retenção.

### Backend
```
DELETE /api/v1/portfolio/{id}              # arquivar (soft delete)
PATCH  /api/v1/portfolio/{id}/restaurar
GET    /api/v1/portfolio/arquivados
DELETE /api/v1/portfolio/{id}/permanente   # admin
```

### Frontend (`frontend/src/app/(dashboard)/portfolio/page.tsx`)
Em cada card: publicar/privar, arquivar, menu de ações, modal de confirmação, loading por item, mensagens de sucesso/erro.

### Critérios de aceite
- Arquivar funciona; some da listagem e do portal público.
- Admin vê arquivados e restaura.
- Exclusão permanente só após confirmação forte (digitar EXCLUIR).
- Toda ação invalida cache do React Query e checa `estudio_id`.

---

## 3. P0 — Redesenhar o dashboard inicial

Painel executivo respondendo: quanto entrou/saiu/sobrou, reservado, a receber, comissões, orçamentos parados, sessões próximas, retorno de clientes, receita por artista, despesas do mês.

- **Linha 1 (financeiro):** Entradas, Saídas, Saldo líquido, Reservas/sinais pendentes, Comissões a pagar, Lucro estimado.
- **Linha 2 (operação):** Orçamentos pendentes, Sessões hoje, Sessões 7 dias, Aguardando sinal, Clientes novos, Conversão orçamento→sessão.
- **Linha 3 (gráficos):** entradas×saídas/dia, receita por artista, por forma de pagamento, por categoria de despesa, evolução do ticket.
- **Linha 4 (alertas):** orçamentos sem resposta 48h, sinais pendentes, comissões a pagar, sessões sem pagamento, estoque abaixo do mínimo.

### Critérios
- Endpoint consolidado (sem cálculo manual no front com dados incompletos).
- Filtro de período (hoje/7d/mês/mês anterior/personalizado).
- Cards clicáveis → tela detalhada; valores batem com o financeiro; funciona em mobile.

---

## 4. P0 — Melhorar profundamente o financeiro

### Modelo evoluído
```
tipo: ENTRADA SAIDA COMISSAO SINAL RESERVA ESTORNO AJUSTE
categoria: SERVICO_TATUAGEM SINAL_RESERVA VENDA_PRODUTO MATERIAL ALUGUEL
           MARKETING TAXA_CARTAO COMISSAO_ARTISTA MANUTENCAO SOFTWARE OUTROS
centro_custo: ESTUDIO ARTISTA ATENDIMENTO ESTOQUE MARKETING ADMINISTRATIVO
origem: MANUAL ATENDIMENTO ORCAMENTO AGENDA ESTOQUE COMISSAO_AUTOMATICA
status: PENDENTE PAGO CANCELADO ESTORNADO PARCIAL
```
Campos novos: categoria, subcategoria, centro_custo, competencia, data_vencimento, data_pagamento, valor_bruto, valor_taxa, valor_liquido, percentual_comissao, valor_comissao, observacao, recorrente, parcelas, parcela_atual, criado_por_id, atualizado_por_id, cancelado_por_id, motivo_cancelamento.

### Telas: Visão geral, Entradas, Saídas, Comissões, Reservas/sinais, Consolidado (com filtros e exportação CSV).

### Critérios
- Saber claramente quanto entrou/saiu/saldo; comissões por artista; reservas/sinais; filtrar e consolidar; exportar CSV; nada de cálculo crítico só no front.

---

## 5. Endpoints recomendados

### Dashboard
```
GET /api/v1/dashboard/resumo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
```
Resposta: { periodo, financeiro{entradas_pagas, entradas_pendentes, saidas_pagas,
saidas_pendentes, saldo_realizado, saldo_previsto, sinais_pagos, sinais_pendentes,
comissoes_pagas, comissoes_pendentes, lucro_estimado, ticket_medio}, operacional{...},
graficos{...}, alertas[] }

### Financeiro
```
GET/POST/PATCH/DELETE /api/v1/financeiro/lancamentos[/{id}]
GET  /api/v1/financeiro/consolidado
GET  /api/v1/financeiro/entradas | /saidas | /comissoes | /reservas
POST /api/v1/financeiro/comissoes/gerar
PATCH /api/v1/financeiro/comissoes/{id}/pagar
POST /api/v1/financeiro/exportar
```

---

## 6. Melhorias visuais
- **Dashboard:** cards financeiros grandes, operacionais menores; cores (verde entrada, vermelho saída, amarelo pendente, azul agenda, roxo comissão); gráficos com legenda; estado vazio profissional; skeleton; cards clicáveis; filtros no topo.
- **Financeiro:** tabs (Visão geral/Entradas/Saídas/Comissões/Reservas/Consolidado); botão primário "Novo lançamento"; secundários por tipo; filtros; tabela com ações; badges de status; resumo fixo; exportação; mobile com cards.
- **Portfólio:** grid elegante, lightbox, menu por imagem, status (público/privado/arquivado), edição de metadados, filtros por status/estilo, busca, tela de arquivados.

---

## 7. Outras áreas
- **Uploads:** padrão único (MIME, magic bytes, tamanho, nome limpo, UUID, dono/estúdio, exclusão segura, anti cross-tenant, erro claro). *(já implementado em `upload_security.py` — reaproveitar)*
- **Auditoria:** logs de exclusão/exclusão permanente/alteração financeira/cancelamento/estorno/pagamento de comissão/visibilidade. *(tabela `audit_logs` já existe)*
- **Permissões:** Admin (tudo); Artista (próprios atendimentos/comissões, não exclui financeiro/imagem permanente); Recepção (cliente/agenda/orçamento, sem lucro consolidado se vetado); Financeiro (entradas/saídas/relatórios).
- **Relatórios:** financeiro mensal, receita por artista, despesas por categoria, comissões, conversão, orçamentos por origem, recorrentes, ticket médio, sinais pendentes, agenda futura.

---

## 8. Trilhas paralelas
- **A — Portfólio/arquivos** (front+back): arquivar→DELETE, arquivados, restaurar, exclusão permanente, auditoria, UI grid, lightbox, edição metadados.
- **B — Backend financeiro:** expandir modelo, categoria/centro de custo, consolidado, filtros, comissão, reserva/sinal, exportação, logs, testes.
- **C — Frontend financeiro:** redesign, tabs, filtros, cards, gráficos, modais (entrada/saída/comissão/reserva), exportação. (mocks até B fechar contratos)
- **D — Dashboard executivo** (front+back): `/dashboard/resumo`, trocar cálculo local, redesign, filtros, gráficos, alertas, links. (depende de B)
- **E — QA:** testes de arquivar/restaurar/excluir, entrada/saída/comissão/reserva/consolidado/dashboard/permissões. (começa junto)

---

## 9. Ordem recomendada
1. Corrigir exclusão/arquivamento do portfólio.
2. Padrão de arquivos (arquivar/restaurar/permanente).
3. Expandir modelo financeiro.
4. Endpoint consolidado financeiro.
5. Redesenhar tela financeira.
6. Dashboard executivo.
7. Gráficos e filtros.
8. Auditoria.
9. Permissões finas.
10. Testes automatizados.
11. Validar em staging.
12. Publicar em produção.

---

## 10. Observação para o time
O financeiro deve ser o **centro de controle** do estúdio: ao abrir, o usuário entende imediatamente quanto entrou, saiu, sobrou, está pendente, deve pagar, quanto cada artista gerou/tem a receber, reservas confirmadas e sessões não pagas. Experiência simples, dados completos.
