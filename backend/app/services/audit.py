"""P0-10 — Serviço de auditoria transacional."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_event(
    session: AsyncSession,
    *,
    acao: str,
    estudio_id: uuid.UUID | str | None = None,
    actor_usuario_id: uuid.UUID | str | None = None,
    actor_tipo: str | None = None,
    entidade: str | None = None,
    entidade_id: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    dados: dict | None = None,
    commit: bool = False,
) -> AuditLog:
    """Registra um evento de auditoria na sessão atual.

    Por padrão apenas adiciona+flush (o commit acompanha a transação do caller).
    Use commit=True para eventos que precisam persistir mesmo que a requisição
    termine em erro depois (ex.: falha de login antes de levantar 401).
    """

    def _uuid(v):
        if v is None or isinstance(v, uuid.UUID):
            return v
        try:
            return uuid.UUID(str(v))
        except (ValueError, AttributeError):
            return None

    log = AuditLog(
        acao=acao,
        estudio_id=_uuid(estudio_id),
        actor_usuario_id=_uuid(actor_usuario_id),
        actor_tipo=actor_tipo,
        entidade=entidade,
        entidade_id=str(entidade_id) if entidade_id is not None else None,
        ip=ip,
        user_agent=(user_agent[:500] if user_agent else None),
        dados=dados,
    )
    session.add(log)
    if commit:
        await session.commit()
    else:
        await session.flush()
    return log
