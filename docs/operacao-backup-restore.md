# Backup & Restore - SessaoInk

## Banco (Neon PostgreSQL)

O Neon e a fonte de backup do banco por backup gerenciado continuo com
Point-in-Time Recovery (PITR). Nao reinventar backup manual de Postgres na app.

### Restore (PITR)

1. Neon -> Restore -> escolher timestamp alvo antes do incidente.
2. Restaurar para branch novo primeiro; nao sobrescrever producao direto.
3. Validar dados no branch restaurado com queries agregadas e sem PII.
4. Apontar a aplicacao para o branch restaurado ou promover, conforme o caso.
5. Atualizar `DATABASE_URL` no Fly se a connection string mudar.
6. Rodar `/ready` e smoke test do backend.

### Evidencia atual

- Ensaio local versionado:
  `docs/evidencias/restore-2026-06-01-local-rehearsal.md`.
- O teste PITR real em Neon deve ser registrado no mesmo diretorio quando houver
  acesso ao painel/API do projeto de producao.

## Storage de uploads

Decisao: migrar uploads para object storage compativel com S3, preferindo
Cloudflare R2 pela ausencia de egress fee e boa compatibilidade com Workers/CDN.

Estado atual:

- Uploads ainda usam `STORAGE_PATH` no volume Fly.
- Volume Fly permanece funcional, mas nao entrega PITR equivalente ao banco.
- Qualquer credencial deve ficar somente em Fly/Vercel/GitHub secrets.

Variaveis planejadas:

- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_REGION`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_PUBLIC_BASE_URL`, se for adotado CDN publico.

## Readiness e alertas

- `/ready` retorna 503 se DB ou Redis estiverem indisponiveis.
- Alertas minimos: 5xx, `/ready` 503, Redis down, pico de 403/429.
- Eventos e dashboards estao descritos em `docs/observabilidade.md`.

## Checklist de prontidao

- [x] Politica de backup do banco delegada ao PITR Neon.
- [x] Ensaio local de restore/retencao registrado sem segredos.
- [x] Decisao de object storage registrada: Cloudflare R2/S3-compatible.
- [x] Variaveis esperadas documentadas sem segredos.
- [x] Healthcheck `/ready` validado em producao.
