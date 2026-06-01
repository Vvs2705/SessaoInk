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
  `alembic current` + contagem de tabelas-chave e registrar evidência sanitizada
  neste repositório.
- Usar o template `docs/evidencias/restore-template.md`.
- Não registrar connection strings, tokens, cookies, dumps, linhas de tabelas ou
  dados pessoais.

## Storage de uploads (Fly → object storage)

- Imagens de portfólio/flash/atendimento ficam em `STORAGE_PATH` no volume do Fly.
- **Risco:** volume local não tem PITR equivalente ao Neon e dificulta restore
  granular de uploads.
- **Direção recomendada:** migrar uploads para object storage compatível com S3
  (Cloudflare R2 ou AWS S3) com versionamento, lifecycle e política de acesso
  privado por padrão.
- **Sem segredos no repositório:** credenciais devem ficar somente em secrets do
  Fly/Vercel/GitHub Actions. Documentar apenas nomes de variáveis esperadas.
- Variáveis esperadas para desenho futuro: `OBJECT_STORAGE_ENDPOINT`,
  `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY_ID`
  e `OBJECT_STORAGE_SECRET_ACCESS_KEY`.
- Até a migração, tratar o volume Fly como ponto de atenção operacional e
  registrar qualquer snapshot/restauração manual como evidência sanitizada.

## Readiness e alertas
- `/ready` falha (503) se DB ou Redis indisponível — usar em healthcheck/monitor.
- Alertas recomendados (P1-04): 5xx, `/ready` 503, Redis down, pico de 403/429.

## Checklist de prontidão
- [ ] Janela de PITR do Neon conhecida e suficiente.
- [ ] Restore testado em branch separado com evidência registrada.
- [ ] Migração para object storage planejada e validada sem segredos no repo.
- [ ] Alertas operacionais configurados e chegando ao canal definido.
