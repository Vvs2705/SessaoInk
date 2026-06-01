# Release — SessaoInk

Este runbook cobre versionamento e publicacao sem expor segredos.

## Versionamento

- Usar SemVer: `MAJOR.MINOR.PATCH`.
- Registrar toda mudanca relevante no `CHANGELOG.md`.
- Manter `docs/openapi.json` atualizado quando houver mudanca de contrato.
- Criar tag Git apenas depois de CI verde e validacao operacional.

## Checklist pre-release

1. Atualizar `CHANGELOG.md`, movendo itens de `Unreleased` para a nova versao.
2. Rodar validacoes locais:

```bash
make check-openapi
cd backend && ruff check . && pyright && pytest -q
cd ../frontend && npm run build
```

3. Confirmar CI verde no GitHub Actions.
4. Conferir se houve mudanca de runtime:
   - backend alterado: deploy Fly e validar `/ready`;
   - frontend alterado: deploy Vercel e validar login/rotas criticas;
   - docs/DevEx apenas: sem deploy obrigatorio.
5. Criar tag anotada:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

6. Criar GitHub Release a partir da tag, copiando as notas do `CHANGELOG.md`.

## Pos-release

- Validar `https://sessaoink-api.fly.dev/ready`.
- Conferir smoke de login com usuario de teste autorizado.
- Registrar incidente ou rollback em `docs/runbook.md` se algo falhar.

## Rollback

- Backend Fly: seguir `docs/deploy.md`.
- Frontend Vercel: promover deployment anterior pelo painel/CLI.
- Banco: nunca aplicar rollback destrutivo sem branch de restore validado no Neon.
