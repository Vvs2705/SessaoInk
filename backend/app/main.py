import logging
import secrets
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import sentry_sdk
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.logging_config import configure_logging

configure_logging(settings.ENVIRONMENT)

logger = logging.getLogger(__name__)

def _sentry_before_send(event, hint):
    """P0-05 — remove segredos/dados de cartão do evento antes de sair para o Sentry."""
    from app.core.pci import redigir_sensivel

    return redigir_sensivel(event)


# Inicializar Sentry apenas se DSN configurado (produção)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        environment=settings.ENVIRONMENT,
        send_default_pii=False,  # LGPD — não enviar dados pessoais
        before_send=_sentry_before_send,
    )
from app.api.v1.admin.router import router as admin_router
from app.api.v1.agenda.router import router as agenda_router
from app.api.v1.atendimentos.router import router as atendimentos_router
from app.api.v1.auditoria.router import router as auditoria_router
from app.api.v1.auth.router import router as auth_router
from app.api.v1.busca.router import router as busca_router
from app.api.v1.clientes.router import router as clientes_router
from app.api.v1.convites.router import router as convites_router
from app.api.v1.dashboard.router import router as dashboard_router
from app.api.v1.documentos.router import router as documentos_router
from app.api.v1.estoque.router import router as estoque_router
from app.api.v1.estudio.router import router as estudio_router
from app.api.v1.financeiro.router import router as financeiro_router
from app.api.v1.flash_arts.router import router as flash_arts_router
from app.api.v1.pagamentos.router import router as pagamentos_router
from app.api.v1.portfolio.router import router as portfolio_router
from app.api.v1.publico.router import router as publico_router
from app.api.v1.relatorios.router import router as relatorios_router
from app.api.v1.usuarios.router import router as usuarios_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "startup",
        extra={"project": settings.PROJECT_NAME, "environment": settings.ENVIRONMENT},
    )
    yield
    logger.info("shutdown")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API de gestão para tatuadores e estúdios de tatuagem",
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS — inclui X-CSRF-Token para validação double-submit
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token"],
)

# Métodos que modificam estado — exigem verificação de Origin
_CSRF_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Endpoints isentos de verificação de Origin (públicos ou sem sessão)
_CSRF_EXEMPT_PREFIXES = (
    "/api/v1/public/",     # portal público — sem autenticação
    "/api/v1/auth/login",  # login — ainda não há sessão para proteger
    "/api/v1/auth/registrar",  # cadastro self-serve — pré-sessão
    # Recuperação de senha: o usuário está deslogado (sem cookie csrf).
    # Protegidas por rate-limit (esqueci) e por token de uso único + TTL (resetar).
    "/api/v1/auth/esqueci-senha",
    "/api/v1/auth/resetar-senha",
    # MFA pré-sessão: ocorrem ANTES de a sessão (e o cookie csrf) existirem.
    # Protegidos pelo token de desafio (vinculado ao usuário, TTL curto).
    "/api/v1/auth/mfa/verificar",
    "/api/v1/auth/mfa/email/solicitar",
    # Aceite de convite: o convidado está deslogado (sem cookie csrf). Protegido
    # pelo token de uso único + TTL (mesma lógica do resetar-senha).
    "/api/v1/convites/aceitar",
    "/api/v1/pagamentos/webhook",  # webhook server-to-server (Mercado Pago), sem browser
    "/health",
)


def _normalizar_origin(origin: str) -> str:
    parsed = urlsplit(origin.strip())
    if not parsed.scheme or not parsed.netloc:
        return origin.strip().lower().rstrip("/")
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def _bearer_token_autorizado(token_esperado: str, authorization: str | None) -> bool:
    if not token_esperado or not authorization:
        return False
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return False
    try:
        token_bytes = token.encode("ascii")
        esperado_bytes = token_esperado.encode("ascii")
    except UnicodeEncodeError:
        return False
    return secrets.compare_digest(token_bytes, esperado_bytes)


@app.middleware("http")
async def csrf_origin_check(request: Request, call_next):
    """Defesa CSRF em profundidade: rejeita Origin estranho em endpoints autenticados.

    Arquitetura: Browser → Vercel Proxy → Fly.io (este servidor).
    O proxy Next.js encaminha o header `X-Origin-Browser` com o Origin real do browser.

    Lógica:
      - Se X-Origin-Browser estiver presente (request passou pelo proxy) e
        seu valor não estiver em ALLOWED_ORIGINS → 403.
      - Se o header não estiver presente (acesso direto à API, mobile, ferramentas)
        → permite passar (não bloqueia acesso legítimo direto).
      - Endpoints públicos e /auth/login são isentos.

    Defesa complementar: o proxy Next.js também rejeita requests mutáveis com
    Origin não autorizado antes de chegarem aqui.
    """
    if request.method in _CSRF_METHODS and settings.ENVIRONMENT == "production":
        path = request.url.path
        is_exempt = any(path.startswith(p) for p in _CSRF_EXEMPT_PREFIXES)

        if not is_exempt:
            if _bearer_token_autorizado(
                settings.LGPD_RETENTION_TOKEN,
                request.headers.get("authorization"),
            ):
                return await call_next(request)

            browser_origin = request.headers.get("x-origin-browser", "")
            if browser_origin:
                allowed = {_normalizar_origin(origin) for origin in settings.ALLOWED_ORIGINS}
                origin_ok = _normalizar_origin(browser_origin) in allowed
                if not origin_ok:
                    logger.warning(
                        "csrf_blocked",
                        extra={
                            "path": path,
                            "browser_origin": browser_origin,
                            "method": request.method,
                        },
                    )
                    return JSONResponse(
                        {"detail": "Origem não autorizada"},
                        status_code=403,
                    )

            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("x-csrf-token")
            if settings.CSRF_STRICT_MODE or csrf_cookie:
                if not csrf_cookie or not csrf_header or csrf_header != csrf_cookie:
                    logger.warning(
                        "csrf_token_blocked",
                        extra={"path": path, "method": request.method},
                    )
                    return JSONResponse(
                        {"detail": "Token CSRF inválido"},
                        status_code=403,
                    )

    return await call_next(request)


# Correlation ID — rastreabilidade ponta a ponta (P1-05)
@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    import uuid as _uuid

    from app.core.logging_config import correlation_id_var

    cid = (
        request.headers.get("x-correlation-id")
        or request.headers.get("x-request-id")
        or _uuid.uuid4().hex
    )
    token = correlation_id_var.set(cid)
    try:
        response = await call_next(request)
    finally:
        correlation_id_var.reset(token)
    response.headers["X-Correlation-ID"] = cid
    return response


# Headers de segurança
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not settings.DEBUG:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' blob: data:; "
            "script-src 'self'; style-src 'self' 'unsafe-inline'"
        )
    return response


# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(atendimentos_router, prefix="/api/v1")
app.include_router(flash_arts_router, prefix="/api/v1")
app.include_router(financeiro_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(pagamentos_router, prefix="/api/v1")
app.include_router(estoque_router, prefix="/api/v1")
app.include_router(publico_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(documentos_router, prefix="/api/v1")
app.include_router(estudio_router, prefix="/api/v1")
app.include_router(busca_router, prefix="/api/v1")
app.include_router(agenda_router, prefix="/api/v1")
app.include_router(relatorios_router, prefix="/api/v1")
app.include_router(usuarios_router, prefix="/api/v1")
app.include_router(convites_router, prefix="/api/v1")
app.include_router(auditoria_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    """Liveness check — a API está de pé."""
    return {"status": "ok", "project": settings.PROJECT_NAME}


@app.get("/ready", tags=["health"])
async def readiness(session: AsyncSession = Depends(get_session)):
    """Readiness check — banco e dependências prontos."""
    from sqlalchemy import text

    from app.core.redis import get_redis
    checks = {}

    # Checar banco
    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Checar Redis
    try:
        async with get_redis() as r:
            await r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    status_code = 200 if all_ok else 503

    return JSONResponse(
        {"status": "ready" if all_ok else "degraded", "checks": checks},
        status_code=status_code,
    )
