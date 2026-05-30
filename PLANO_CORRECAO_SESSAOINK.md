# PLANO DE CORRECAO E RETOMADA - SESSAOINK

Data base: 2026-05-30
Status real: MVP incompleto. Nao considerar nenhum modulo como 100% concluido ate passar pelos criterios de aceite deste arquivo.
Fonte de verdade: este arquivo substitui ROADMAP.md, _memoria/, _equipes/ e docs/ locais antigos.

## Regra central

Nada deve ser tratado como pronto apenas porque existe tela, endpoint ou texto de roadmap. Pronto significa:

1. A acao funciona ponta a ponta.
2. O erro aparece para o usuario quando algo falha.
3. O backend valida permissao, tenant e dados de entrada.
4. Existe teste cobrindo o fluxo principal e pelo menos um erro relevante.
5. Build, typecheck e testes passam sem excecao.

## Ordem obrigatoria

Nao pular fases. Segurança e integridade vem antes de UX e melhorias.

1. Segurança, auth, CSRF, cookies e middleware.
2. Contratos backend e isolamento por estudio.
3. Botões, rotas e fluxos quebrados no frontend.
4. Portal publico e orçamento.
5. Documentos, financeiro e agenda.
6. Testes automatizados e E2E.
7. Deploy/observabilidade somente depois do produto local passar.

## Agentes que devem ser acionados

### 1. AGENTE SECURITY COMPLIANCE LGPD PCI

Responsavel por:
- Corrigir cookies de auth para producao.
- Definir e implementar protecao CSRF para endpoints mutaveis que usam cookie.
- Corrigir middleware do Next.js para nao liberar rotas internas como se fossem portal publico.
- Definir politica RBAC real para ADMIN, ARTISTA e RECEPCIONISTA.
- Garantir isolamento por estudio em todas as operacoes com ids recebidos do frontend.
- Revisar endpoint publico de orçamento contra spam, abuso, scraping e vazamento de dados.

Nao aceitar como resolvido enquanto:
- Nenhuma rota interna for acessivel sem cookie valido.
- Nenhum usuario puder ler, criar, editar ou deletar dado de outro estudio.
- Cookies em producao tiverem secure, httpOnly, sameSite adequado e path correto.
- Endpoints publicos tiverem rate limit real e resposta segura.

### 2. AGENTE PYTHON DATA AUTOMATION / backend-developer

Responsavel por:
- Revisar todos os routers FastAPI e alinhar contratos com o frontend.
- Validar cliente_id, atendimento_id, artista_id e documento_id sempre contra usuario.estudio_id.
- Completar endpoints ausentes de portal publico para portfolio e flash arts publicas.
- Completar fluxo de documentos: assinatura, aceite, IP, versao, trilha de auditoria e visualizacao segura.
- Completar financeiro: editar lancamento, cancelar, marcar pago, estornar, conciliar com atendimento e comissao.
- Completar agenda: criar/agendar sessao pelo frontend, reagendar e validar conflitos basicos.
- Remover prints de producao e usar logging.

Nao aceitar como resolvido enquanto:
- Todo endpoint mutavel tiver validacao de tenant.
- Todo erro de negocio retornar HTTP correto e mensagem segura.
- Schemas Pydantic refletirem exatamente o que o frontend envia e recebe.
- Migrations estiverem consistentes com os models.

### 3. AGENTE FRONTEND ECOMMERCE ENTERPRISE / frontend-developer

Responsavel por:
- Fazer todos os botoes primarios executarem uma acao real ou remover/desabilitar com justificativa visual.
- Corrigir Novo Cliente, Adicionar Cliente, Novo Atendimento, Criar Atendimento e Agendar Sessao.
- Criar rotas de detalhe para clientes e atendimentos, ou alterar navegacao para nao apontar para pagina inexistente.
- Fazer cards com cursor-pointer realmente navegarem ou abrirem detalhe.
- Fazer BuscaModal destacar/navegar para o item certo, lendo query params como destaque.
- Corrigir rotas publicas faltantes: /[slug]/flash-arts e, se mantida no middleware, /[slug]/portfolio.
- Mostrar erroEnvio no formulario de orçamento.
- Validar etapas do orçamento antes de avancar.
- Enviar todos os campos previstos pelo backend: tamanho/tamanho_cm, observacoes e dados obrigatorios.
- Substituir placeholders fixos por dados reais ou empty states honestos.

Nao aceitar como resolvido enquanto:
- Nenhum botao visivel estiver sem onClick, href, submit ou estado disabled intencional.
- Nenhum link apontar para rota inexistente.
- Nenhuma pagina publica depender de texto generico quando existe API para dados reais.
- Estados loading, empty e error existirem nas telas principais.

### 4. AGENTE PRODUCT UX CONVERSION / ui-ux-director

Responsavel por:
- Revisar fluxos do ponto de vista do tatuador e do cliente final.
- Garantir que empty states expliquem o proximo passo sem parecer pagina quebrada.
- Tornar o formulario de orçamento confiavel: validacao por etapa, feedback claro, sucesso com protocolo e erro visivel.
- Definir comportamento correto para upload de referencias: implementar upload real ou remover a promessa visual.
- Revisar textos de seguranca e privacidade do portal publico.

Nao aceitar como resolvido enquanto:
- Um usuario novo souber o que fazer em clientes, atendimentos, agenda, portfolio, financeiro e documentos.
- O cliente final conseguir pedir orçamento sem cair em etapa sem funcao.
- Todo CTA principal tiver valor claro e consequencia real.

### 5. AGENTE QA TEST AUTOMATION + AGENTE TEST WRITER

Responsaveis por:
- Criar plano minimo de regressao.
- Adicionar testes backend para: clientes, financeiro, documentos, estoque, flash arts, agenda, busca, relatorios, auth refresh, alterar senha, RBAC e isolamento por tenant.
- Criar stack frontend de testes se ainda nao existir.
- Adicionar E2E para: login, protecao de rota, dashboard, criar cliente, criar atendimento, agendar sessao, orçamento publico, upload portfolio, publicar foto, logout.
- Adicionar teste de rotas inexistentes/links quebrados.

Nao aceitar como resolvido enquanto:
- Backend passar em pytest.
- Frontend passar em typecheck/build.
- E2E minimo cobrir os fluxos criticos.
- Testes falharem quando um botao sem acao ou rota quebrada voltar.

### 6. AGENTE CODE REVIEWER ENTERPRISE

Responsavel por:
- Fazer revisao final depois das correcoes.
- Bloquear commit se houver risco de auth, tenant, dados pessoais, upload, rota quebrada ou contrato frontend/backend desalinhado.
- Validar se nao foram adicionados segredos, tokens ou credenciais em arquivos do projeto.

Nao aceitar como resolvido enquanto:
- Nao houver achados P0/P1 abertos.
- Segredos estiverem fora do repositorio e fora de docs locais versionaveis.
- O diff estiver focado no escopo.

### 7. AGENTE DEVOPS SRE CLOUD

Acionar apenas depois da validacao local.

Responsavel por:
- Corrigir inconsistencia de porta/API entre next.config, client API e backend.
- Revisar variaveis de ambiente reais.
- Revisar Fly/Vercel somente com confirmacao explicita antes de deploy.
- Garantir que nenhum token esteja escrito em markdown.
- Definir checklist de producao sem expor segredos.

Nao aceitar como resolvido enquanto:
- Local, preview e producao tiverem URLs coerentes.
- Healthcheck funcionar.
- Logs nao mostrarem crash loop.
- Deploy so ocorrer apos confirmacao humana.

### 8. AGENTE ENTERPRISE ARCHITECT

Responsavel por:
- Amarrar decisoes de dominio para RBAC, financeiro, documentos/aceite, portal publico e entidades de lead/orçamento.
- Evitar remendo que crie acoplamento ruim entre frontend e backend.

Nao aceitar como resolvido enquanto:
- Cada decisao critica tiver dono, contrato e criterio de aceite.
- O fluxo orçamento -> cliente/lead -> atendimento -> agenda -> financeiro estiver coerente.

## Problemas concretos ja identificados

### Bloqueadores de seguranca

- Cookies de auth precisam configuracao segura para producao.
- Falta protecao CSRF clara para endpoints mutaveis com cookie.
- Middleware pode liberar rotas internas por tratar path lowercase como portal publico.
- RBAC existe no modelo, mas nao e aplicado de forma consistente.
- Validacao de tenant precisa existir antes de usar ids enviados pelo frontend.
- Endpoint publico de orçamento precisa rate limit/anti-spam e modelagem correta de lead/cliente.

### Frontend incompleto

- Botoes sem acao: Novo Cliente, Adicionar Cliente, Novo Atendimento, Criar Atendimento, Agendar Sessao.
- Cards com aparencia clicavel sem navegacao real.
- Link para /atendimentos/[id] sem pagina dinamica correspondente.
- Busca global navega com query params que as paginas nao consomem.
- Portal publico nao consome completamente os dados publicos reais.
- Link /[slug]/flash-arts existe, mas a rota precisa existir e funcionar.
- Portfolio publico ainda aparece como placeholder.
- Upload de referencias no orçamento e apenas visual se nao houver input/envio real.
- Formulario de orçamento avanca sem validacao minima.
- Erro de envio do orçamento precisa aparecer na UI.

### Backend incompleto

- Portal publico precisa endpoints para portfolio e flash arts publicas.
- Documentos precisam fluxo real de aceite/assinatura e auditoria.
- Financeiro precisa update, cancelamento, marcar pago, estorno e conciliacao com atendimento.
- Agenda precisa criacao/reagendamento pelo frontend e validacoes.
- Testes de atendimento indicam contrato possivelmente desalinhado com schema atual.
- Prints em producao devem virar logging.

### QA ausente ou insuficiente

- Frontend nao pode ficar sem stack de teste.
- E2E minimo precisa proteger login, rotas privadas, orçamento publico, uploads e CTAs principais.
- Backend precisa cobrir RBAC e tenant isolation antes de qualquer deploy.

### DevOps/ambiente

- Conferir porta/API usada por frontend e backend; nao aceitar 8000 em um lugar e 8001 em outro sem motivo documentado.
- Nao manter tokens, DSNs, DATABASE_URL ou SECRET_KEY em markdown.
- Deploy em Fly/Vercel exige confirmacao explicita.

## Plano de execucao

### Fase 1 - Seguranca e middleware

Arquivos provaveis:
- backend/app/api/v1/auth/router.py
- backend/app/api/v1/auth/dependencies.py
- backend/app/core/config.py
- backend/app/core/redis.py
- frontend/src/middleware.ts

Entregas:
- Cookie seguro por ambiente.
- CSRF ou estrategia equivalente documentada e implementada.
- Middleware com allowlist publica explicita: login, assets Next, APIs necessarias e rotas publicas reais por slug.
- Dependencias de permissao reutilizaveis.
- Validacao de tenant padronizada.

Validacao:
- Usuario sem cookie nao acessa dashboard nem rotas internas.
- Rota publica real funciona sem login.
- Rota interna lowercase nao e liberada sem login.
- Testes backend de auth/RBAC passam.

### Fase 2 - Backend de dominio

Arquivos provaveis:
- backend/app/api/v1/clientes/router.py
- backend/app/api/v1/atendimentos/router.py
- backend/app/api/v1/agenda/router.py
- backend/app/api/v1/financeiro/router.py
- backend/app/api/v1/documentos/router.py
- backend/app/api/v1/publico/router.py
- backend/app/api/v1/portfolio/router.py
- backend/app/api/v1/flash_arts/router.py
- backend/app/models/*
- backend/app/schemas/*
- backend/migrations/versions/*

Entregas:
- Contratos completos para todos os fluxos usados pelo frontend.
- Endpoints publicos de portfolio/flash arts.
- Documento com aceite/assinatura/auditoria.
- Financeiro com ciclo completo.
- Agenda com criacao e reagendamento.
- Validacao de tenant em todos os ids.

Validacao:
- pytest cobrindo sucesso, erro, sem auth, permissao insuficiente e tenant errado.
- Alembic upgrade roda limpo.

### Fase 3 - Frontend funcional

Arquivos provaveis:
- frontend/src/app/(dashboard)/clientes/page.tsx
- frontend/src/app/(dashboard)/clientes/[id]/page.tsx
- frontend/src/app/(dashboard)/atendimentos/page.tsx
- frontend/src/app/(dashboard)/atendimentos/[id]/page.tsx
- frontend/src/app/(dashboard)/agenda/page.tsx
- frontend/src/app/[slug]/page.tsx
- frontend/src/app/[slug]/orcamento/page.tsx
- frontend/src/app/[slug]/flash-arts/page.tsx
- frontend/src/components/BuscaModal.tsx
- frontend/src/lib/api/client.ts

Entregas:
- Modais ou paginas de criacao para cliente, atendimento e agenda.
- Rotas de detalhe ou UX alternativa consistente.
- Busca com destaque real.
- Portal publico com dados reais.
- Orçamento validado por etapa e erro visivel.
- Rota publica de flash arts.
- Upload de referencias implementado ou removido da promessa visual.

Validacao:
- npm run build passa.
- npx tsc --noEmit passa.
- Teste visual manual confirma que nenhum CTA principal esta morto.

### Fase 4 - Testes e regressao

Arquivos provaveis:
- backend/tests/*
- frontend/package.json
- frontend/tests/*
- frontend/playwright.config.* ou equivalente

Entregas:
- Scripts de teste frontend.
- Testes unitarios/integracao frontend onde fizer sentido.
- E2E minimo com Playwright.
- Testes backend cobrindo as rotas criticas.

Validacao:
- pytest passa.
- npm run test passa, se criado.
- npx playwright test passa, se criado.

### Fase 5 - Revisao final e deploy

Entregas:
- Code review final sem P0/P1.
- Scan manual para segredos.
- Checklist de deploy sem tokens.
- Deploy somente se Vinicius confirmar explicitamente.

Validacao:
- git status revisado.
- Nenhum arquivo de cache, .env, token ou build artifact aparece no diff.
- Healthcheck local antes de qualquer deploy.

## Comandos de verificacao esperados

Backend:
```powershell
cd "C:\Users\VINICIUS\Videos\MEUS PROJETOS\SessaoInk\backend"
pytest
alembic upgrade head
```

Frontend:
```powershell
cd "C:\Users\VINICIUS\Videos\MEUS PROJETOS\SessaoInk\frontend"
npm run build
npx tsc --noEmit
```

Raiz:
```powershell
cd "C:\Users\VINICIUS\Videos\MEUS PROJETOS\SessaoInk"
git status --short
```

Observacao: se o caminho com acento for usado no terminal, preferir copiar o caminho real do Explorer para evitar problema de encoding.

## Arquivos que nao devem voltar

- _memoria/
- _equipes/
- docs/ vazia ou com passo a passo ja substituido
- ROADMAP.md antigo
- frontend/tsconfig.tsbuildinfo
- backend/.pytest_cache/
- backend/.venv/
- .claude/
- qualquer markdown contendo tokens, DATABASE_URL, SECRET_KEY, DSN ou credenciais reais

## Definicao final de pronto

O projeto so pode ser chamado de MVP pronto quando:

1. Todas as fases acima estiverem concluidas.
2. Todos os testes passarem.
3. O review final nao tiver bloqueadores.
4. Nao houver botao sem funcao.
5. Nao houver pagina publica ou privada quebrada.
6. Nao houver segredo em arquivo do projeto.
7. O fluxo principal funcionar: login -> dashboard -> cliente -> atendimento -> agenda -> financeiro -> portfolio -> portal publico -> orçamento.
