# API — SessaoInk

Contrato versionado: [`docs/openapi.json`](openapi.json).

## Base URLs

- Producao backend Fly: `https://sessaoink-api.fly.dev`
- Desenvolvimento local: `http://localhost:8000`
- Todas as rotas de negocio usam o prefixo `/api/v1`, exceto healthchecks (`/health`, `/ready`).

## Autenticacao

O login em `POST /api/v1/auth/login` autentica o usuario e define cookies `HttpOnly`.
As rotas autenticadas leem o cookie `access_token`; `POST /api/v1/auth/refresh` usa
o `refresh_token` para renovar sessao. `POST /api/v1/auth/logout` limpa cookies e
revoga o refresh token no Redis quando disponivel.

Papeis principais:

- `ADMIN`: acesso administrativo ao estudio.
- `TATUADOR`: acesso operacional ao estudio.
- `ARTISTA`: acesso limitado conforme regras de ownership por recurso.

## Grupos de endpoints

| Tag OpenAPI | Prefixo | Uso |
| --- | --- | --- |
| `auth` | `/api/v1/auth` | login, refresh, logout e senha |
| `clientes` | `/api/v1/clientes` | cadastro e consulta de clientes |
| `agenda` | `/api/v1/agenda` | agendamento e conflito de horarios |
| `atendimentos` | `/api/v1/atendimentos` | fluxo operacional de atendimentos e imagens |
| `financeiro` | `/api/v1/financeiro` | lancamentos, status e resumo financeiro |
| `documentos` | `/api/v1/documentos` | contratos, links e assinatura |
| `portfolio` | `/api/v1/portfolio` | upload e publicacao de portfolio |
| `flash-arts` | `/api/v1/flash-arts` | flash arts e publicacao |
| `portal-publico` | `/api/v1/public` | paginas publicas, orcamento e documentos por token |
| `auditoria` | `/api/v1/auditoria` | consulta de eventos de auditoria |
| `admin` | `/api/v1/admin` | operacoes administrativas, como gatilhos LGPD |
| `health` | `/health`, `/ready` | liveness e readiness |

## Erros padronizados

As respostas de erro seguem o formato FastAPI:

```json
{
  "detail": "Mensagem do erro"
}
```

Para validacao de payload, `422` retorna uma lista de erros em `detail`.

| Status | Quando ocorre |
| --- | --- |
| `400` | regra de negocio invalida, spam honeypot, payload sem aceite obrigatorio |
| `401` | cookie ausente, token expirado ou credenciais invalidas |
| `403` | origem nao autorizada ou permissao insuficiente |
| `404` | recurso, arquivo, estudio, convite ou token publico inexistente |
| `409` | conflito de negocio, como horario ocupado ou convite duplicado |
| `410` | convite expirado |
| `422` | validacao de schema/campos |
| `429` | rate limit de login ou orcamento publico |
| `503` | `/ready` degradado por dependencia indisponivel |

## Atualizacao do contrato

Gerar localmente:

```bash
make openapi
```

Checar que o contrato versionado esta sincronizado com o FastAPI:

```bash
make check-openapi
```

O CI tambem executa a geracao e falha se `docs/openapi.json` ficar diferente do
schema produzido por `backend/scripts/generate_openapi.py`.
