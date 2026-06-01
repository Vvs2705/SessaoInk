# Backup & Restore — SessãoInk

## Banco (Neon PostgreSQL)

O Neon oferece **backup gerenciado contínuo** com Point-in-Time Recovery (PITR).
Não é necessário (nem recomendado) reinventar backup do Postgres manualmente.

### Verificar PITR (fazer trimestralmente)
1. Painel Neon → projeto → **Branches / Restore**.
2. Confirmar a janela de retenção do plano (history retention). Anotar o valor.
3. Confirmar que o branch de produção tem PITR habilitado.

### Restore (PITR)
1. Neon → **Restore** → escolher timestamp alvo (antes do incidente).
2. Restaurar para um **branch novo** primeiro (não sobrescrever produção direto).
3. Validar dados no branch restaurado (queries de sanidade).
4. Apontar a aplicação para o branch restaurado **ou** promover, conforme o caso.
5. Atualizar `DATABASE_URL` no Fly se a connection string mudar; redeploy/restart.

### Teste de restore (registrar evidência)
- Periodicamente (ex.: trimestral): restaurar para branch de teste, rodar
  `alembic current` + contagem de tabelas-chave, anexar print/log neste repositório
  (ex.: `docs/evidencias/restore-YYYY-MM-DD.md`).

## Storage de uploads (Fly)

- Imagens de portfólio/flash/atendimento ficam em `STORAGE_PATH` no volume do Fly.
- **Risco:** volume efêmero/local não tem PITR. Avaliar migração para storage de
  objetos (S3/R2) com versionamento — **TODO** (P2). Até lá, considerar snapshot
  do volume Fly se persistência crítica.

## Readiness e alertas
- `/ready` falha (503) se DB ou Redis indisponível — usar em healthcheck/monitor.
- Alertas recomendados (P1-04): 5xx, `/ready` 503, Redis down, pico de 403/429.

## Checklist de prontidão
- [ ] Janela de PITR do Neon conhecida e suficiente.
- [ ] Restore testado em branch separado com evidência registrada.
- [ ] Estratégia de storage de uploads definida (volume vs object storage).
- [ ] Alertas operacionais configurados e chegando ao canal definido.
