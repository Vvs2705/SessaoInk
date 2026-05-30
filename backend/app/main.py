from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.auth.router import router as auth_router
from app.api.v1.clientes.router import router as clientes_router
from app.api.v1.atendimentos.router import router as atendimentos_router
from app.api.v1.flash_arts.router import router as flash_arts_router
from app.api.v1.financeiro.router import router as financeiro_router
from app.api.v1.estoque.router import router as estoque_router
from app.api.v1.publico.router import router as publico_router
from app.api.v1.portfolio.router import router as portfolio_router
from app.api.v1.documentos.router import router as documentos_router
from app.api.v1.estudio.router import router as estudio_router
from app.api.v1.busca.router import router as busca_router
from app.api.v1.agenda.router import router as agenda_router
from app.api.v1.relatorios.router import router as relatorios_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[START] {settings.PROJECT_NAME} - modo {settings.ENVIRONMENT}")
    yield
    print("[STOP] Encerrando...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="API de gestão para tatuadores e estúdios de tatuagem",
    openapi_url="/api/v1/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)


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
app.include_router(clientes_router, prefix="/api/v1")
app.include_router(atendimentos_router, prefix="/api/v1")
app.include_router(flash_arts_router, prefix="/api/v1")
app.include_router(financeiro_router, prefix="/api/v1")
app.include_router(estoque_router, prefix="/api/v1")
app.include_router(publico_router, prefix="/api/v1")
app.include_router(portfolio_router, prefix="/api/v1")
app.include_router(documentos_router, prefix="/api/v1")
app.include_router(estudio_router, prefix="/api/v1")
app.include_router(busca_router, prefix="/api/v1")
app.include_router(agenda_router, prefix="/api/v1")
app.include_router(relatorios_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check():
    return JSONResponse({
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
    })
