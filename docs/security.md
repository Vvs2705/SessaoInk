# Segurança — SessãoInk

Resumo dos controles de segurança implementados (épico de hardening P0).

## Autenticação
- JWT de acesso (HS256) com claims `iss`, `aud`, `jti`, `iat`, `exp`, `type=access`.
  O decodificador valida assinatura, expiração, `iss`, `aud` e `type`.
- Access token: 15 min. Refresh token: `secrets.token_urlsafe(48)`, armazenado no
  Redis **apenas como hash SHA-256**, com rotação a cada `/refresh`.
- Cookies `HttpOnly`, `Secure` (produção), `SameSite=Lax`.
- Troca/reset de senha revoga **todas** as sessões. Endpoint `POST /auth/logout-all`.

## Autorização (RBAC)
- Papéis: `ADMIN`, `ARTISTA`, `RECEPCIONISTA`.
- `require_role(*roles)` (FastAPI dependency). ADMIN-only: config do estúdio,
  financeiro (criar/editar/excluir), relatórios, convites, auditoria.

## Multi-tenant
- Toda query sensível filtra por `estudio_id` do usuário autenticado.
- Acesso cross-tenant retorna 404 (sem vazar existência). Testes em
  `tests/integration/test_rbac_tenant.py`.

## CSRF
- Estratégia: **SameSite=Lax + validação de Origin em 2 camadas**.
  - Proxy Next.js rejeita mutações com `Origin` ≠ `APP_ORIGIN` (produção).
  - Backend valida `X-Origin-Browser` (encaminhado pelo proxy) contra `ALLOWED_ORIGINS`.
- Cookies vivem no domínio Vercel (same-site com o proxy) — sem requisições cross-site.
- Incremento planejado: double-submit token (`csrf_token` + `X-CSRF-Token`).

## Upload seguro (`app/core/upload_security.py`)
- Limite de tamanho antes do disco (413), magic bytes (JPEG/PNG/WEBP), bloqueio de
  SVG/HTML/PDF/exe, MIME consistente, re-encode Pillow removendo EXIF/metadados,
  nome de arquivo por token, SHA-256. Mesmo pipeline em upload privado e público.

## Trusted proxy / IP real
- `get_client_ip()` resolve o IP real do browser via `X-Forwarded-For`/`Fly-Client-IP`.
- Rate limit de login por IP real (não pelo IP do servidor Vercel).

## Guardrails de produção
- `Settings` aborta o startup se em produção: `DEBUG=true`, `SECRET_KEY` < 32/fraca,
  `ALLOWED_ORIGINS` vazio/wildcard, `DATABASE_URL`/`REDIS_URL` em localhost.

## Auditoria
- Tabela `audit_logs` (append-only) + `services/audit.log_event`. Eventos:
  `auth.login.success/failure`, `documento.link_generated`, `documento.signed`.
- Consulta admin: `GET /api/v1/auditoria` (ADMIN, restrito ao próprio estúdio).

## Headers
- Backend: `X-Content-Type-Options`, `X-Frame-Options=DENY`, `Referrer-Policy`,
  `Permissions-Policy`, CSP (produção). Frontend: CSP no `next.config.js`.
- Pendente: remover `unsafe-inline`/`unsafe-eval` da CSP do frontend.

## Política de secrets
- Nenhum segredo versionado. `RESEND_API_KEY` apenas como secret do Fly.
- `NEXT_PUBLIC_API_URL` não é definida na Vercel (ativa modo proxy).
- CI roda gitleaks (bloqueante).

## LGPD
- Retenção de orçamentos públicos não convertidos: **anonimização após 180 dias**.
- Aceite de privacidade/termos capturado no orçamento público.
