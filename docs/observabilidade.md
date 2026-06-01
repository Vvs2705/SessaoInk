# Observabilidade - SessaoInk

## Eventos PostHog versionados

Eventos sem PII emitidos pelo frontend:

- `auth_login`: login via painel.
- `cliente_mutation`: criacao/edicao/remocao de clientes.
- `agenda_mutation`: criacao/edicao/remocao de agenda.
- `atendimento_mutation`: mudancas em atendimentos.
- `pagamento_mutation`: mudancas financeiras.
- `documento_mutation`: mudancas de documentos no painel.
- `documento_publico_assinado`: assinatura publica de documento.
- `portfolio_mutation`: publicacao/upload/remocao de portfolio.
- `flash_art_mutation`: publicacao/upload/remocao de flash.
- `orcamento_publico_enviado`: envio de orcamento pelo portal publico.

Propriedades padrao:

- `method`: metodo HTTP para eventos do painel.
- `path`: rota chamada, sem payload.
- `status`: `success` ou `error`.
- Propriedades especificas sem PII, como `slug`, `tipo` e contagem de imagens.

## Alertas Sentry recomendados

- Backend 5xx acima do baseline por 5 minutos.
- `/ready` retornando 503.
- Pico de 403 em rotas autenticadas, possivel CSRF/origin bug.
- Pico de 429 em login/publico, possivel abuso.
- Erros React em `global-error` quando o handler estiver habilitado.

## Logs operacionais

- Backend usa logs estruturados com correlation id.
- Eventos LGPD gravam auditoria em `audit_logs` com `acao=lgpd.anonymized`.
- O workflow `LGPD Retention` deve ser acompanhado pelo GitHub Actions.

## Dashboard minimo

Criar ou revisar no PostHog:

- Funil: `auth_login` -> `cliente_mutation` -> `agenda_mutation` ->
  `atendimento_mutation` -> `pagamento_mutation`.
- Funil publico: pageview do portal -> `orcamento_publico_enviado`.
- Serie: `documento_publico_assinado`.
- Serie de erro: eventos com `status=error`.
