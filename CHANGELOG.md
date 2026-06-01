# Changelog

Todas as mudancas relevantes deste projeto devem ser registradas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o versionamento segue SemVer.

## [Unreleased]

### Added

- Documentacao publica do contrato de API em `docs/api.md`.
- Checagem de OpenAPI versionado no CI e alvo `make check-openapi`.
- Configuracao inicial de pre-commit com Ruff, Ruff Format e checks basicos.
- Runbook de release em `docs/release.md`.
- Template de evidencia trimestral de restore em `docs/evidencias/restore-template.md`.

### Changed

- Runbook de backup/restore passou a registrar criterios de migracao de uploads para object storage.

## [1.0.0] - 2026-06-01

### Added

- Baseline operacional: API FastAPI, frontend Next.js, CI GitHub Actions,
  backend Fly, frontend Vercel e contrato OpenAPI versionado.
