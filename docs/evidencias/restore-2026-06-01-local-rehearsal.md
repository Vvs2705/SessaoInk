# Evidencia de restore - 2026-06-01

## Escopo

- Ambiente restaurado: ensaio local automatizado com banco SQLite de teste.
- Timestamp alvo do PITR: nao aplicavel ao ensaio local.
- Branch Neon de destino: nao aplicavel.
- Responsavel: Codex.

## Comandos/validacoes executadas

```powershell
cd backend
python -m pytest tests/integration/test_lgpd_orcamentos.py tests/integration/test_lgpd_admin.py -q
python -m pytest tests/integration/test_csrf.py -q
```

## Evidencias permitidas

- `test_lgpd_orcamentos.py` exercita dados expirados, imagens vinculadas,
  idempotencia e endpoint administrativo.
- `test_lgpd_admin.py` exercita gatilho admin, dry-run e token de servico.
- `test_csrf.py` exercita modo estrito e isencao por token de servico.

## Resultado

- [x] Migration/test database inicializa limpa via fixtures.
- [x] Tabelas-chave e modelos envolvidos carregam corretamente.
- [x] Retencao LGPD e auditoria funcionam em banco restauravel local.
- [x] CSRF estrito protege mutacoes autenticadas.

## Observacoes

- Esta evidencia nao substitui teste PITR real no Neon. Ela registra o ensaio
  automatizado local que pode ser repetido sem segredos e sem dados pessoais.
- O teste PITR real depende de acesso ao painel/API Neon do projeto de producao.
