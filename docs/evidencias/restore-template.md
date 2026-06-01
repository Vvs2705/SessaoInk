# Evidencia de restore — AAAA-MM-DD

Use este template para registrar teste trimestral de restore sem incluir segredos,
connection strings, dumps ou dados pessoais.

## Escopo

- Ambiente restaurado:
- Timestamp alvo do PITR:
- Branch Neon de destino:
- Responsavel:

## Comandos/validacoes executadas

```bash
cd backend
alembic current
python - <<'PY'
# Registrar apenas contagens agregadas e nomes de tabelas esperadas.
PY
```

## Evidencias permitidas

- Prints do painel Neon com nomes de projeto/branch e sem connection string.
- Saida de `alembic current` sem URL de banco.
- Contagens agregadas de tabelas-chave, sem linhas ou payloads.
- Resultado de `/ready` contra ambiente restaurado, sem headers/cookies.

## Resultado

- [ ] Restore criado em branch separado.
- [ ] Migration head consistente.
- [ ] Tabelas-chave presentes.
- [ ] Aplicacao inicializa contra o branch restaurado.
- [ ] Branch temporario removido ou retido com justificativa.

## Observacoes

- Nao registrar segredos, tokens, cookies, connection strings ou dados pessoais.
- Se houver divergencia, abrir issue/PR com causa e acao corretiva.
