# Seguranca - SessaoInk

Resumo dos controles de seguranca implementados no hardening P0/P1.

## Autenticacao

- JWT de acesso (HS256) com claims `iss`, `aud`, `jti`, `iat`, `exp`,
  `type=access`.
- O decodificador valida assinatura, expiracao, `iss`, `aud` e `type`.
- Access token: 15 min. Refresh token: `secrets.token_urlsafe(48)`, armazenado
  no Redis apenas como hash SHA-256, com rotacao a cada `/refresh`.
- Cookies `HttpOnly`, `Secure` em producao, `SameSite=Lax`.
- Troca/reset de senha revoga todas as sessoes. Endpoint `POST /auth/logout-all`.

## Autorizacao (RBAC)

- Papeis: `ADMIN`, `ARTISTA`, `RECEPCIONISTA`.
- `require_role(*roles)` para dependencias FastAPI.
- ADMIN-only: configuracao do estudio, financeiro sensivel, relatorios,
  convites, auditoria e gatilhos administrativos.

## Multi-tenant

- Toda query sensivel filtra por `estudio_id` do usuario autenticado.
- Acesso cross-tenant retorna 404 para nao vazar existencia.
- ARTISTA tem owner-check granular em recursos proprios de agenda,
  atendimentos, portfolio e flash.

## CSRF

- Estrategia: SameSite=Lax + validacao de Origin em 2 camadas +
  double-submit estrito.
- Proxy Next.js rejeita mutacoes com `Origin` diferente de `APP_ORIGIN` em
  producao.
- Backend valida `X-Origin-Browser` contra `ALLOWED_ORIGINS`.
- Backend exige `csrf_token` cookie + `X-CSRF-Token` igual em
  POST/PUT/PATCH/DELETE autenticados quando `CSRF_STRICT_MODE=true`.
- Endpoints publicos e login permanecem isentos.
- O token de servico LGPD usa `Authorization: Bearer` e nao depende de
  cookie/browser.

## Upload seguro

- `app/core/upload_security.py` aplica limite de tamanho antes do disco,
  validacao por magic bytes, bloqueio de SVG/HTML/PDF/exe, MIME consistente,
  re-encode Pillow removendo EXIF/metadados, nome de arquivo por token e
  SHA-256.
- O mesmo pipeline protege uploads privados e publicos.

## Trusted proxy / IP real

- `get_client_ip()` resolve o IP real via `X-Forwarded-For`/`Fly-Client-IP`.
- Rate limit de login usa IP real, nao o IP do servidor Vercel.

## Guardrails de producao

- `Settings` aborta startup em producao se houver `DEBUG=true`, `SECRET_KEY`
  curta/fraca, `ALLOWED_ORIGINS` vazio/wildcard ou `DATABASE_URL`/`REDIS_URL`
  em localhost.
- Producao tambem exige `LGPD_RETENTION_TOKEN` forte para o cron de retencao.

## Auditoria

- Tabela `audit_logs` append-only + `services/audit.log_event`.
- Eventos principais: login, assinatura de documento, retencao LGPD e acoes
  operacionais sensiveis.
- Consulta admin: `GET /api/v1/auditoria`, restrita ao proprio estudio.

## Headers

- Backend: `X-Content-Type-Options`, `X-Frame-Options=DENY`,
  `Referrer-Policy`, `Permissions-Policy` e CSP em producao.
- Frontend: `script-src 'self'`, sem `unsafe-eval` e sem
  `script-src 'unsafe-inline'`.
- `style-src 'unsafe-inline'` permanece por compatibilidade com estilos inline
  existentes em telas do dashboard.

## Politica de secrets

- Nenhum segredo versionado.
- `LGPD_RETENTION_TOKEN` existe como secret do GitHub Actions e secret do Fly.
- `NEXT_PUBLIC_API_URL` nao e definida na Vercel, ativando o proxy Next.js.
- CI roda gitleaks de forma bloqueante.

## LGPD

- Retencao de orcamentos publicos nao convertidos: anonimizacao apos 180 dias.
- Aceite de privacidade/termos capturado no orcamento publico.
- GitHub Actions `LGPD Retention` executa diariamente com
  `LGPD_RETENTION_TOKEN`.
- `POST /api/v1/admin/lgpd/anonimizar` aceita ADMIN autenticado ou token de
  servico; chamadas de servico rodam globalmente e gravam auditoria como
  `actor_tipo=service`.
