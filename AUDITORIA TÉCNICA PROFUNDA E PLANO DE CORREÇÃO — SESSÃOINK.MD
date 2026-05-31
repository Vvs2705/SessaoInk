# AUDITORIA TÉCNICA PROFUNDA E PLANO DE CORREÇÃO — SESSÃOINK

**Data:** 30/05/2026
**Repositório analisado:** `Vvs2705/SessaoInk`
**Objetivo:** transformar o projeto de uma interface visual/parcial em um produto funcional, testável, seguro e pronto para evolução por time.

## 1. Escopo da análise

Esta análise foi feita por revisão estática do repositório no GitHub. Não executei o projeto localmente, não rodei banco, build, testes automatizados ou upload real em ambiente produtivo. Portanto, as recomendações abaixo devem ser tratadas como plano técnico de execução e validação.

O repositório está organizado como monorepo com `backend`, `frontend`, `infra`, `brand_assets`, `docker-compose.yml`, `vercel.json` e um arquivo já existente chamado `PLANO_CORRECAO_SESSAOINK.md`. A composição principal do código é TypeScript e Python. ([GitHub][1])

O próprio repositório já reconhece que o **MVP está incompleto** e define uma ordem obrigatória de correção: segurança/autenticação, contratos backend, botões/rotas frontend, portal público/orçamento, documentos/financeiro/agenda, testes e deploy/observabilidade. ([GitHub][2])

---

## 2. Diagnóstico executivo

O problema central do SessãoInk não é apenas visual. O projeto já tem várias telas e componentes, mas ainda precisa de uma rodada forte de **consolidação funcional**, **segurança**, **contratos de API**, **testes E2E** e **padronização de marca**.

Pontos críticos:

1. **Middleware de autenticação com risco alto:** o frontend libera rotas públicas baseado em padrão de slug. Como rotas internas do dashboard também são URLs simples como `/clientes`, `/agenda`, `/financeiro`, existe risco de rota protegida ser tratada como portal público. O middleware atual valida cookie `access_token`, mas antes disso permite caminhos que batem com o regex público. ([GitHub][3])

2. **Vários botões já possuem handlers no código atual, mas não podem ser considerados prontos sem teste ponta a ponta.** Por exemplo, “Novo Cliente” abre modal e usa POST/PATCH em `/api/v1/clientes/`; “Novo Atendimento” abre modal e envia POST para `/api/v1/atendimentos/`; “Agendar Sessão” envia POST para `/api/v1/agenda/agendar`. ([GitHub][4])

3. **Upload de orçamento não parece estar apenas visual no código atual**, pois o frontend monta `FormData`, adiciona arquivos no campo `imagens` e envia para `/api/v1/public/${slug}/orcamento`. O backend também aceita `UploadFile`, salva arquivos fisicamente e registra `AtendimentoImagem`. Se o upload não está funcionando em produção, a causa provável está em ambiente, URL da API, CORS, storage persistente, tamanho de request, permissões ou ausência de teste E2E validando o fluxo real. ([GitHub][5])

4. **O portal público tem API de portfolio, mas o frontend público não possui pasta `/[slug]/portfolio`.** Existe `[slug]/page.tsx`, `[slug]/orcamento` e `[slug]/flash-arts`, mas não há rota pública dedicada `[slug]/portfolio`, apesar de o middleware e o backend tratarem `/portfolio`. ([GitHub][6])

5. **A logo e a identidade precisam virar sistema, não imagem solta.** O frontend possui assets como `logo-wide.png`, favicons e manifest, mas a aplicação precisa de componente oficial de marca, variantes, proporção, espaçamento, fallback e regras de uso. ([GitHub][7])

6. **Faltam scripts e estrutura de testes no frontend.** O `package.json` tem `dev`, `build`, `start` e `lint`, mas não há scripts de `test`, `typecheck` dedicado ou E2E. ([GitHub][8])

---

## 3. Prioridade máxima: corrigir segurança antes de polir UX

### P0-01 — Reescrever o middleware de rotas públicas e protegidas

**Problema:** o middleware atual permite rotas públicas por regex de slug. Isso é perigoso porque rotas internas de dashboard também usam caminhos simples.

**Como corrigir:**

* Criar lista explícita de rotas públicas reais:

  * `/login`
  * `/registro`
  * `/senha`
  * `/:slug`
  * `/:slug/orcamento`
  * `/:slug/flash-arts`
  * `/:slug/portfolio`, somente se a página frontend for implementada.
* Criar lista explícita de rotas protegidas:

  * `/`
  * `/agenda`
  * `/atendimentos`
  * `/clientes`
  * `/configuracoes`
  * `/documentos`
  * `/estoque`
  * `/financeiro`
  * `/flash-arts`
  * `/portfolio`
  * `/relatorios`
  * `/mais`
* Validar primeiro se a rota é protegida. Só depois aplicar lógica de portal público.
* Criar teste automatizado para garantir que `/clientes`, `/agenda`, `/financeiro` e `/documentos` redirecionam para login sem cookie válido.

**Critério de aceite:**

* Usuário deslogado não acessa nenhuma rota do dashboard.
* Portal público continua funcionando sem login.
* Middleware não depende de regex genérico que confunde slug com rota interna.

**Pode ser feito em paralelo com:** P0-02, P0-03 e QA de rotas.

---

### P0-02 — Garantir isolamento multi-tenant no backend

**Problema:** o backend já filtra dados por `usuario.estudio_id` em rotas como clientes e atendimentos, mas isso precisa ser padronizado, testado e obrigatório em todos os módulos. Clientes e atendimentos usam `get_usuario_atual` e filtram por `estudio_id`, o que é correto, mas precisa ser auditado em todos os routers. ([GitHub][9])

**Como corrigir:**

* Criar helper ou dependency padrão: `get_estudio_context`.
* Nenhuma query de entidade privada deve ocorrer sem `estudio_id`.
* Criar testes backend tentando acessar IDs de outro estúdio.
* Padronizar resposta `404` para recurso inexistente ou de outro estúdio.
* Validar isso em:

  * clientes
  * atendimentos
  * agenda
  * financeiro
  * documentos
  * estoque
  * portfolio
  * flash arts
  * configurações/usuários

**Critério de aceite:**

* Usuário A nunca lê, edita, agenda, arquiva ou baixa arquivo do Estúdio B.
* Testes automatizados cobrem tentativa de acesso cruzado.

**Pode ser feito em paralelo com:** frontend visual, logo e QA, mas deve bloquear deploy.

---

### P0-03 — Corrigir e validar upload de arquivos em produção

**Situação atual:** o código já tenta enviar arquivos no orçamento público usando `FormData` e campo `imagens`; o backend recebe `UploadFile`, salva em `STORAGE_PATH/uploads/{estudio_id}/atendimentos/{atendimento_id}` e registra no banco. ([GitHub][5])

**Hipóteses prováveis para o upload falhar:**

* `NEXT_PUBLIC_API_URL` ausente ou apontando para host errado.
* CORS não permitindo origem correta.
* Backend indisponível ou “dormindo” no primeiro request.
* Volume persistente não montado ou sem permissão.
* Limite de tamanho de request.
* Falta de validação de tipo/tamanho de arquivo.
* Erro silencioso no frontend.
* Ausência de tela interna para visualizar as imagens salvas.
* Ambiente local usando porta diferente do ambiente esperado.

O backend está configurado no Fly com `STORAGE_PATH="/storage"` e volume persistente montado em `/storage`, então o time precisa validar se o volume existe, está montado e tem permissão de escrita no app real. ([GitHub][10])

**Como corrigir:**

* No frontend:

  * mostrar progresso de upload;
  * limitar quantidade de imagens;
  * validar tipo MIME real;
  * validar tamanho máximo por arquivo;
  * exibir erro claro quando API falhar;
  * impedir submit duplicado;
  * limpar `URL.createObjectURL` ao desmontar componente;
  * adicionar mensagem “upload concluído” somente após resposta `201`.

* No backend:

  * validar `content_type`;
  * validar tamanho máximo;
  * bloquear extensões perigosas;
  * gerar nome seguro;
  * salvar arquivo em storage transacional;
  * se salvar arquivo e falhar banco, remover arquivo;
  * se salvar banco e falhar arquivo, fazer rollback;
  * criar endpoint autenticado para listar imagens de atendimento;
  * criar endpoint seguro para visualizar imagem de atendimento;
  * adicionar logs sem dados sensíveis.

* No deploy:

  * validar env `NEXT_PUBLIC_API_URL`;
  * validar `ALLOWED_ORIGINS`;
  * validar volume Fly;
  * validar limite de upload;
  * testar upload de imagem real no ambiente final.

**Critério de aceite:**

* Cliente público envia orçamento com 1, 3 e 5 imagens.
* Atendimento aparece no dashboard.
* Imagens aparecem no detalhe do atendimento.
* Arquivo sobrevive a restart/deploy.
* Erros de upload são visíveis para o usuário.

**Pode ser feito em paralelo com:** criação da tela de detalhe do atendimento e testes E2E.

---

## 4. Correções funcionais por módulo

### 4.1 Clientes

O fluxo de cliente já possui implementação parcial/real: o frontend abre modal, usa submit, faz `POST /api/v1/clientes/` ou `PATCH /api/v1/clientes/{id}`; o backend possui rotas GET, POST, GET por ID, PATCH e DELETE lógico por `ativo = False`. ([GitHub][4])

**O que fazer:**

* Validar contrato entre `ClienteCreate`, formulário e payload.
* Adicionar feedback visual padronizado:

  * carregando;
  * sucesso;
  * erro de validação;
  * erro de servidor.
* Criar página ou drawer de detalhe do cliente.
* Vincular histórico de atendimentos ao cliente.
* Permitir arquivar cliente com confirmação.
* Criar máscara de telefone/WhatsApp.
* Criar testes:

  * criar cliente;
  * editar cliente;
  * listar cliente;
  * arquivar cliente;
  * impedir acesso cross-tenant.

**Critério de aceite:**

* Botão “Novo Cliente” cria cliente real.
* Botão “Adicionar Cliente” do empty state cria cliente real.
* Cliente aparece na listagem sem refresh manual.
* Cliente pode ser editado e arquivado.

---

### 4.2 Atendimentos

O frontend possui modal de “Novo Atendimento” e envia `POST /api/v1/atendimentos/`. O schema backend permite `cliente_id`, `artista_id`, `tipo`, `descricao`, `parte_corpo`, `estilo`, `tamanho_cm`, valores, forma de pagamento, notas e data de sessão. ([GitHub][11])

**O que fazer:**

* Incluir seleção/criação rápida de cliente dentro do atendimento.
* Incluir seleção de artista quando houver múltiplos usuários.
* Garantir que atendimento vindo do orçamento público mostre:

  * dados de contato;
  * descrição;
  * parte do corpo;
  * estilo;
  * tamanho;
  * imagens de referência;
  * aceite de termos.
* Criar tela/drawer de detalhe com ações reais:

  * alterar status operacional;
  * alterar status financeiro;
  * agendar sessão;
  * anexar imagens;
  * registrar observações;
  * converter orçamento em atendimento confirmado;
  * cancelar/arquivar.
* Padronizar status:

  * solicitado;
  * em análise;
  * confirmado;
  * em andamento;
  * concluído;
  * cancelado.
* Criar testes E2E para todo o ciclo.

**Critério de aceite:**

* Todo atendimento criado aparece no dashboard.
* Atendimento pode ser aberto, editado, agendado e ter status alterado.
* Atendimento público via orçamento aparece como solicitado.
* Imagens de referência aparecem no detalhe.

---

### 4.3 Agenda

O frontend envia `POST /api/v1/agenda/agendar`, e o backend agenda ou reagenda uma sessão vinculada a atendimento existente, alterando status para confirmado quando estava solicitado ou em análise. ([GitHub][12])

**O que fazer:**

* Validar conflitos de horário.
* Validar duração mínima e máxima.
* Usar timezone consistente: Brasil/São Paulo.
* Mostrar agenda diária, semanal e mensal.
* Permitir reagendar.
* Permitir cancelar sessão.
* Bloquear agendamento sem atendimento válido.
* Adicionar confirmação antes de reagendar.
* Criar teste de conflito:

  * dois atendimentos no mesmo horário não podem ser agendados para o mesmo artista.

**Critério de aceite:**

* “Agendar Sessão” agenda uma sessão real.
* Dashboard reflete a próxima sessão.
* Reagendamento atualiza a agenda.
* Cancelamento remove ou marca sessão corretamente.
* Conflitos são bloqueados.

---

### 4.4 Orçamento público

O formulário público de orçamento possui campos de nome, WhatsApp, Instagram, descrição, estilo, parte do corpo, tamanho, aceite de privacidade, aceite de termos e upload de imagens. ([GitHub][5])

**O que fazer:**

* Validar WhatsApp.
* Exigir descrição mínima.
* Exigir consentimentos.
* Adicionar proteção anti-spam:

  * rate limit por IP;
  * honeypot invisível;
  * bloqueio por volume;
  * logs de abuso.
* Criar protocolo rastreável.
* Enviar notificação interna para dashboard.
* Opcional: enviar WhatsApp/email automático futuramente.
* Mostrar página de sucesso com protocolo.
* Criar teste E2E público:

  * acessar `/:slug/orcamento`;
  * preencher;
  * anexar imagem;
  * enviar;
  * validar criação do atendimento no painel.

**Critério de aceite:**

* Orçamento público cria atendimento real.
* Imagens ficam acessíveis ao estúdio.
* Usuário recebe protocolo.
* Erros aparecem de forma clara.
* Spam básico é mitigado.

---

### 4.5 Portfolio público

O backend possui endpoint público de portfolio por slug e filtra por visibilidade pública, autorização de publicação e ativo. Porém, no frontend público existem apenas `[slug]`, `[slug]/orcamento` e `[slug]/flash-arts`; falta rota dedicada `[slug]/portfolio`. ([GitHub][13])

**O que fazer:**

* Criar `frontend/src/app/[slug]/portfolio/page.tsx`.
* Consumir `GET /api/v1/public/{slug}/portfolio`.
* Mostrar grid responsivo.
* Criar estado vazio profissional.
* Abrir imagem em modal/lightbox.
* Garantir que somente itens autorizados aparecem.
* Adicionar CTA para orçamento a partir de item do portfolio.

**Critério de aceite:**

* `/:slug/portfolio` abre página real.
* Itens públicos aparecem.
* Itens privados/autorização falsa não aparecem.
* Imagens carregam em produção.

---

### 4.6 Flash arts

**O que fazer:**

* Garantir CRUD interno completo.
* Garantir publicação/despublicação.
* Garantir status:

  * disponível;
  * reservado;
  * vendido;
  * oculto.
* No portal público:

  * listar apenas disponíveis;
  * permitir CTA “quero essa flash”;
  * criar orçamento já vinculado à flash art.
* Adicionar upload de imagem com validação igual ao orçamento.

**Critério de aceite:**

* Estúdio cadastra flash art.
* Publica/despublica.
* Cliente público visualiza.
* Cliente solicita orçamento a partir da flash.

---

### 4.7 Financeiro

**O que fazer:**

* Revisar todos os botões de financeiro.
* Criar ações reais:

  * registrar pagamento;
  * marcar sinal pago;
  * marcar total pago;
  * estornar;
  * cancelar cobrança;
  * editar valor;
  * filtrar por status.
* Garantir vínculo com atendimento.
* Criar resumo financeiro real.
* Criar logs de alteração financeira.

**Critério de aceite:**

* Alterações financeiras refletem no atendimento.
* Dashboard financeiro bate com registros.
* Não há botão visual sem mutação real.

---

### 4.8 Documentos

**O que fazer:**

* Mapear documentos necessários:

  * termo de consentimento;
  * autorização de imagem;
  * anamnese;
  * pós-cuidados;
  * termo de menor, se aplicável.
* Criar geração de documento por atendimento/cliente.
* Criar status:

  * pendente;
  * enviado;
  * assinado;
  * expirado;
  * cancelado.
* Registrar auditoria:

  * IP;
  * user agent;
  * data/hora;
  * versão do documento.
* Criar visualização e download seguro.

**Critério de aceite:**

* Documento é criado a partir de atendimento.
* Cliente consegue assinar ou aceitar.
* Estúdio visualiza status.
* Documento não é público sem token seguro.

---

## 5. Logo e identidade visual

A logo precisa sair do uso amador e virar componente de design system.

**Problemas prováveis:**

* Uso direto de imagem em múltiplos lugares.
* Falta de proporção padronizada.
* Falta de versão clara/escura.
* Falta de fallback.
* Falta de regra de espaçamento.
* Logo possivelmente esticada, cortada ou aplicada sem respiro.

**Como corrigir:**

* Criar componente único:

  * `BrandLogo`
  * props: `variant`, `size`, `withText`, `className`
* Usar somente esse componente em:

  * login;
  * dashboard;
  * sidebar;
  * portal público;
  * página de erro;
  * manifest/favicons quando aplicável.
* Preferir SVG vetorial para logo principal.
* Manter PNG apenas como fallback.
* Criar guia em `brand_assets/README.md`:

  * cores oficiais;
  * uso em fundo claro;
  * uso em fundo escuro;
  * margem mínima;
  * tamanhos mínimos;
  * exemplos proibidos.

**Critério de aceite:**

* Nenhuma tela importa logo manualmente.
* Logo não distorce.
* Header/sidebar/login usam o mesmo componente.
* Existe documentação de marca.

---

## 6. Qualidade, testes e CI

O frontend atualmente tem scripts de desenvolvimento, build, start e lint, mas falta stack de testes no `package.json`. ([GitHub][8])

**Adicionar scripts:**

```json
{
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "check": "npm run lint && npm run typecheck && npm run test && npm run build"
}
```

**Testes obrigatórios frontend:**

* Login.
* Logout.
* Proteção de rota.
* Criar cliente.
* Editar cliente.
* Criar atendimento.
* Agendar sessão.
* Enviar orçamento público com upload.
* Visualizar imagens no atendimento.
* Publicar portfolio.
* Visualizar portfolio público.
* Publicar flash art.
* Solicitar orçamento por flash art.

**Testes obrigatórios backend:**

* Auth e cookies.
* Tenant isolation.
* CRUD clientes.
* CRUD atendimentos.
* Agenda/reagendamento/conflito.
* Upload público.
* Portfolio público.
* Flash arts.
* Financeiro.
* Documentos.
* Rate limit do orçamento público.

**CI obrigatório:**

* Backend:

  * `ruff` ou equivalente;
  * `pytest`;
  * `alembic upgrade head`;
  * teste de import da aplicação.
* Frontend:

  * `npm ci`;
  * `npm run lint`;
  * `npm run typecheck`;
  * `npm run build`;
  * `npm run test`;
  * `npm run test:e2e` em ambiente staging.

---

## 7. Plano de execução paralelo

### Trilha A — Segurança e backend base

Pode começar imediatamente.

Responsáveis: backend/sênior.

Tarefas:

* P0-01 middleware.
* P0-02 tenant isolation.
* auth/cookies/CSRF.
* padronizar erros.
* validar schemas.
* rate limit público.
* testes backend.

Bloqueia deploy: sim.

---

### Trilha B — Upload e arquivos

Pode começar em paralelo após validação de contrato.

Responsáveis: backend + frontend.

Tarefas:

* validar `NEXT_PUBLIC_API_URL`;
* validar CORS;
* validar volume Fly;
* validar limites;
* criar endpoints de listagem/visualização de imagem;
* criar UI de imagens no detalhe do atendimento;
* criar teste E2E de upload.

Bloqueia deploy: sim, porque o usuário já reportou upload quebrado.

---

### Trilha C — Funcionalidade do dashboard

Pode começar em paralelo com A, usando mocks quando necessário.

Responsáveis: frontend + backend.

Tarefas:

* clientes completo;
* atendimento completo;
* agenda completa;
* financeiro completo;
* documentos completo;
* busca global real;
* estados vazios profissionais.

Bloqueia deploy: parcialmente. Clientes, atendimento e agenda são essenciais.

---

### Trilha D — Portal público

Pode começar em paralelo, mas depende de correção do middleware.

Responsáveis: frontend.

Tarefas:

* orçamento público;
* portfolio público;
* flash arts público;
* CTAs reais;
* estados de erro;
* responsividade;
* SEO básico.

Bloqueia deploy: sim para orçamento; portfolio pode ir em fase seguinte se não for promessa comercial imediata.

---

### Trilha E — Marca e design system

Pode começar imediatamente sem bloquear backend.

Responsáveis: frontend/design.

Tarefas:

* componente `BrandLogo`;
* tokens de cor;
* padronizar botões;
* padronizar cards;
* padronizar modais;
* README de marca;
* remover uso manual e inconsistente da logo.

Bloqueia deploy: não, mas melhora percepção profissional.

---

### Trilha F — QA e documentação

Deve começar no dia 1, não no final.

Responsáveis: QA/devs.

Tarefas:

* matriz de rotas;
* matriz de botões;
* matriz de permissões;
* testes manuais;
* testes E2E;
* critérios de aceite;
* checklist de release.

Bloqueia deploy: sim.

---

## 8. Regra obrigatória para botões

Nenhum botão pode ficar apenas visual.

Todo botão deve cair em uma destas categorias:

1. **Ação real:** possui `onClick`, `submit` ou mutation.
2. **Navegação real:** possui `href`/`Link` para rota existente.
3. **Desabilitado propositalmente:** possui `disabled`, tooltip e motivo claro.
4. **Feature futura:** não deve aparecer para usuário final, ou deve estar atrás de feature flag.

Checklist para cada botão:

* O botão executa algo?
* Mostra loading?
* Mostra sucesso?
* Mostra erro?
* Atualiza a tela?
* É testado?
* Tem permissão correta?
* Funciona no mobile?
* Funciona com teclado?
* Tem estado vazio?

---

## 9. Checklist de release

O projeto só deve ser considerado pronto quando:

* [ ] Rotas protegidas bloqueiam usuário deslogado.
* [ ] Portal público funciona sem login.
* [ ] Middleware não confunde slug com dashboard.
* [ ] Login e logout funcionam.
* [ ] Criar cliente funciona.
* [ ] Editar cliente funciona.
* [ ] Arquivar cliente funciona.
* [ ] Criar atendimento funciona.
* [ ] Atendimento mostra detalhe completo.
* [ ] Orçamento público cria atendimento.
* [ ] Upload de imagens funciona em produção.
* [ ] Imagens aparecem no detalhe do atendimento.
* [ ] Agenda cria sessão real.
* [ ] Agenda impede conflitos.
* [ ] Financeiro tem ações reais.
* [ ] Documentos têm fluxo real ou botões ocultos.
* [ ] Portfolio público existe ou link é removido.
* [ ] Flash arts têm fluxo completo.
* [ ] Logo usa componente padronizado.
* [ ] Não há botão sem função.
* [ ] Não há página estática fingindo funcionalidade.
* [ ] Frontend passa lint, typecheck, build e testes.
* [ ] Backend passa testes e migrations.
* [ ] Deploy staging validado.
* [ ] Deploy produção validado.

---

## 10. Branches recomendadas

* `fix/auth-middleware-public-routes`
* `fix/backend-tenant-isolation`
* `fix/public-budget-upload`
* `feat/atendimento-detail-images`
* `feat/portfolio-public-page`
* `feat/agenda-conflict-validation`
* `feat/financeiro-actions`
* `feat/documentos-flow`
* `refactor/brand-logo-design-system`
* `test/e2e-critical-flows`
* `ci/full-quality-gates`

---

## 11. Ordem final recomendada

1. Corrigir middleware e segurança.
2. Validar backend e tenant isolation.
3. Corrigir upload real em produção.
4. Fechar clientes, atendimentos e agenda.
5. Implementar detalhe de atendimento com imagens.
6. Implementar portfolio público ou remover links.
7. Completar financeiro e documentos.
8. Padronizar logo/design system.
9. Adicionar testes automatizados.
10. Rodar staging completo.
11. Somente depois publicar produção.

---

## 12. Conclusão

O SessãoInk tem uma base promissora, mas precisa ser tratado como **produto em recuperação de MVP**, não como simples ajuste visual. O foco do time deve ser: segurança, funcionalidade real, contratos consistentes, upload confiável, rotas públicas/protegidas corretas, testes ponta a ponta e identidade visual profissional.

A regra de ouro para esta fase:

> **Nada deve parecer funcional sem ser funcional. Nenhum botão deve existir sem ação real, rota real ou motivo claro para estar desabilitado.**

[1]: https://github.com/Vvs2705/SessaoInk "GitHub - Vvs2705/SessaoInk · GitHub"
[2]: https://github.com/Vvs2705/SessaoInk/blob/main/PLANO_CORRECAO_SESSAOINK.md "SessaoInk/PLANO_CORRECAO_SESSAOINK.md at main · Vvs2705/SessaoInk · GitHub"
[3]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/src/middleware.ts "SessaoInk/frontend/src/middleware.ts at main · Vvs2705/SessaoInk · GitHub"
[4]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/src/app/%28dashboard%29/clientes/page.tsx "SessaoInk/frontend/src/app/(dashboard)/clientes/page.tsx at main · Vvs2705/SessaoInk · GitHub"
[5]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/src/app/%5Bslug%5D/orcamento/page.tsx "SessaoInk/frontend/src/app/[slug]/orcamento/page.tsx at main · Vvs2705/SessaoInk · GitHub"
[6]: https://github.com/Vvs2705/SessaoInk/tree/main/frontend/src/app/%5Bslug%5D "SessaoInk/frontend/src/app/[slug] at main · Vvs2705/SessaoInk · GitHub"
[7]: https://github.com/Vvs2705/SessaoInk/tree/main/frontend/public "SessaoInk/frontend/public at main · Vvs2705/SessaoInk · GitHub"
[8]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/package.json "SessaoInk/frontend/package.json at main · Vvs2705/SessaoInk · GitHub"
[9]: https://github.com/Vvs2705/SessaoInk/blob/main/backend/app/api/v1/clientes/router.py "SessaoInk/backend/app/api/v1/clientes/router.py at main · Vvs2705/SessaoInk · GitHub"
[10]: https://github.com/Vvs2705/SessaoInk/blob/main/backend/fly.toml "SessaoInk/backend/fly.toml at main · Vvs2705/SessaoInk · GitHub"
[11]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/src/app/%28dashboard%29/atendimentos/page.tsx "SessaoInk/frontend/src/app/(dashboard)/atendimentos/page.tsx at main · Vvs2705/SessaoInk · GitHub"
[12]: https://github.com/Vvs2705/SessaoInk/blob/main/frontend/src/app/%28dashboard%29/agenda/page.tsx "SessaoInk/frontend/src/app/(dashboard)/agenda/page.tsx at main · Vvs2705/SessaoInk · GitHub"
[13]: https://github.com/Vvs2705/SessaoInk/blob/main/backend/app/api/v1/publico/router.py "SessaoInk/backend/app/api/v1/publico/router.py at main · Vvs2705/SessaoInk · GitHub"
