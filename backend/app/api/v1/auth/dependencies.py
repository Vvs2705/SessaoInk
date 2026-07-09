"""Dependências de autenticação para injeção via FastAPI."""

import uuid
from collections.abc import Callable

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import decodificar_token
from app.models.usuario import TipoUsuario, Usuario
from app.services.assinatura import acesso_liberado, get_assinatura, motivo_bloqueio


async def get_usuario_atual(
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> Usuario:
    """Valida o cookie access_token e retorna o usuário autenticado."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not access_token:
        raise credentials_exception

    try:
        payload = decodificar_token(access_token)
        usuario_id_str: str | None = payload.get("sub")
        if not usuario_id_str:
            raise credentials_exception
        usuario_id = uuid.UUID(usuario_id_str)
    except (ValueError, AttributeError):
        raise credentials_exception

    result = await session.execute(
        select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.ativo,
        )
    )
    usuario = result.scalar_one_or_none()

    if not usuario:
        raise credentials_exception

    return usuario


async def get_estudio_id(
    usuario: Usuario = Depends(get_usuario_atual),
) -> uuid.UUID:
    """Retorna o estudio_id do usuário autenticado."""
    return usuario.estudio_id


# Mensagens pt-BR do bloqueio por assinatura (detail estruturado do 402).
MENSAGENS_BLOQUEIO = {
    "trial_expirado": "Seu período de teste terminou. Assine um plano para continuar usando o SessãoInk.",
    "assinatura_expirada": "Sua assinatura expirou. Renove o plano para continuar usando o SessãoInk.",
    "suspensa": "Sua assinatura está suspensa. Regularize o pagamento para continuar.",
    "inadimplente": "Há um pagamento pendente. Regularize para continuar usando o SessãoInk.",
    "cancelada": "Sua assinatura foi cancelada. Assine um plano para continuar.",
    "sem_assinatura": "Seu estúdio não possui uma assinatura ativa. Assine um plano para continuar.",
}


async def exigir_assinatura_ativa(
    usuario: Usuario = Depends(get_usuario_atual),
    session: AsyncSession = Depends(get_session),
) -> Usuario:
    """Bloqueia (402) o acesso às rotas de negócio quando o estúdio não tem
    trial vigente nem assinatura ativa. ADMIN e não-ADMIN são igualmente
    bloqueados — pagar/ver configurações fica em rotas isentas (pagamentos,
    usuarios/estudio, lgpd, auth)."""
    assinatura = await get_assinatura(session, usuario.estudio_id)
    if not acesso_liberado(assinatura):
        motivo = motivo_bloqueio(assinatura) or "sem_assinatura"
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "motivo": motivo,
                "mensagem": MENSAGENS_BLOQUEIO.get(
                    motivo, MENSAGENS_BLOQUEIO["sem_assinatura"]
                ),
            },
        )
    return usuario


def require_role(*roles: TipoUsuario) -> Callable:
    """Dependência de RBAC — exige que o usuário tenha um dos roles especificados.

    Uso:
        @router.get("/admin-only")
        async def admin_only(u: Usuario = Depends(require_role(TipoUsuario.ADMIN))):
            ...

        @router.post("/financeiro")
        async def financeiro(u: Usuario = Depends(require_role(TipoUsuario.ADMIN, TipoUsuario.ARTISTA))):
            ...

    A validação de autenticação é feita primeiro (via get_usuario_atual).
    Retorna 403 se o role não for suficiente, 401 se não autenticado.
    """
    async def _verificar_role(
        usuario: Usuario = Depends(get_usuario_atual),
    ) -> Usuario:
        if usuario.tipo not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissão insuficiente para esta operação.",
            )
        return usuario

    return _verificar_role

