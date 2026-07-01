"""Direitos do titular (LGPD art. 18) — acesso/portabilidade e solicitação de exclusão.

O titular aqui é o **usuário da conta** (dono/equipe do estúdio), cujos dados
pessoais o SessãoInk controla diretamente. Dados dos clientes do estúdio são de
titularidade de terceiros — o estúdio é o controlador e os gerencia pelas telas
de clientes/atendimentos; não entram nesta exportação pessoal.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.auth.dependencies import get_usuario_atual
from app.core.database import get_session
from app.core.request_context import get_client_ip, get_user_agent
from app.models.usuario import Estudio, Usuario
from app.services.audit import log_event

router = APIRouter(prefix="/lgpd", tags=["lgpd"])


@router.get("/exportar")
async def exportar_meus_dados(
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
) -> dict:
    """Direito de acesso e portabilidade (LGPD art. 18, II e V).

    Retorna os dados pessoais do usuário autenticado em JSON estruturado. NUNCA
    inclui segredos (hash de senha, segredo TOTP). O download é montado no cliente.
    """
    estudio = await session.get(Estudio, usuario.estudio_id)

    export = {
        "gerado_em": datetime.now(UTC).isoformat(),
        "titular": {
            "id": str(usuario.id),
            "nome": usuario.nome,
            "email": usuario.email,
            "papel": usuario.tipo.value,
            "criado_em": (
                usuario.criado_em.isoformat() if usuario.criado_em else None
            ),
            "verificacao_duas_etapas": {
                "app_autenticador": usuario.mfa_totp_ativo,
                "email": usuario.mfa_email_ativo,
            },
        },
        "estudio": {
            "id": str(estudio.id) if estudio else str(usuario.estudio_id),
            "nome": estudio.nome if estudio else None,
            "slug": estudio.slug if estudio else None,
        },
        "aviso": (
            "Este arquivo contém os dados pessoais vinculados à sua conta no "
            "SessãoInk. Dados de terceiros (clientes do estúdio) não são incluídos."
        ),
    }

    await log_event(
        session,
        acao="lgpd.dados.exportados",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        commit=True,
    )
    return export


@router.post("/solicitar-exclusao", status_code=202)
async def solicitar_exclusao(
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_usuario_atual),
) -> dict:
    """Direito de eliminação (LGPD art. 18, VI).

    Registra a solicitação de forma **auditável** e NÃO executa exclusão
    destrutiva automática: parte dos dados tem obrigação legal/fiscal de guarda
    (ex.: registros de pagamento, art. 16 LGPD) e o estúdio pode ter outros
    usuários/clientes vinculados. O operador processa a exclusão com essas
    ressalvas dentro do prazo legal.
    """
    await log_event(
        session,
        acao="lgpd.exclusao.solicitada",
        estudio_id=usuario.estudio_id,
        actor_usuario_id=usuario.id,
        actor_tipo=usuario.tipo.value,
        entidade="usuario",
        entidade_id=str(usuario.id),
        ip=get_client_ip(request),
        user_agent=get_user_agent(request),
        dados={"email": usuario.email},
        commit=True,
    )
    return {
        "message": (
            "Solicitação de exclusão registrada. Processaremos seu pedido dentro do "
            "prazo legal, preservando apenas os dados com obrigação legal de guarda."
        )
    }
