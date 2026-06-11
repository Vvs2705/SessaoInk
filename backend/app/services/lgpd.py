"""Servicos de retencao e anonimizacao LGPD."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import montar_key, remover_objeto
from app.models.atendimento import Atendimento, StatusOperacional
from app.models.cliente import Cliente

_STATUS_NAO_CONVERTIDOS = (
    StatusOperacional.SOLICITADO,
    StatusOperacional.EM_ANALISE,
    StatusOperacional.CANCELADO_CLIENTE,
    StatusOperacional.CANCELADO_ESTUDIO,
    StatusOperacional.NAO_COMPARECEU,
)

# Marcador gravado em Cliente.observacoes pelo pré-cadastro do orçamento público.
# Permite distinguir cadastros automáticos (sujeitos à retenção do orçamento)
# de clientes cadastrados manualmente pelo estúdio.
MARCADOR_PRE_CADASTRO = "Pré-cadastro automático via orçamento do portal público."


@dataclass(frozen=True)
class ResultadoAnonimizacaoLGPD:
    candidatos: int
    anonimizados: int


async def _remover_imagem_atendimento(
    atendimento: Atendimento, imagem_path: str
) -> bool:
    key = montar_key(
        str(atendimento.estudio_id),
        "atendimentos",
        str(atendimento.id),
        imagem_path,
    )
    try:
        await remover_objeto(key)
        return True
    except Exception:
        # Falha de storage nao deve mascarar a anonimizacao dos dados no banco.
        # A referencia original e preservada enquanto a delecao fisica nao ocorrer.
        return False


async def anonimizar_orcamentos_publicos_expirados(
    session: AsyncSession,
    *,
    agora: datetime | None = None,
    estudio_id: UUID | None = None,
    limite: int | None = None,
    dry_run: bool = False,
) -> ResultadoAnonimizacaoLGPD:
    """Anonimiza orcamentos publicos nao convertidos com retencao vencida."""
    referencia = agora or datetime.now(UTC)

    # Nota: o pré-cadastro automático vincula cliente_id na criação do orçamento,
    # então "convertido" é determinado pelo status operacional (estúdio confirmou/
    # atendeu), não pela presença de cliente_id.
    query = (
        select(Atendimento)
        .where(
            Atendimento.orcamento_publico.is_(True),
            Atendimento.lgpd_retencao_ate.is_not(None),
            Atendimento.lgpd_retencao_ate <= referencia,
            Atendimento.lgpd_anonimizado_em.is_(None),
            Atendimento.status_operacional.in_(_STATUS_NAO_CONVERTIDOS),
        )
        .order_by(Atendimento.lgpd_retencao_ate.asc())
    )
    if estudio_id is not None:
        query = query.where(Atendimento.estudio_id == estudio_id)
    if limite is not None:
        query = query.limit(limite)

    result = await session.execute(query)
    candidatos = list(result.scalars().all())

    if dry_run:
        return ResultadoAnonimizacaoLGPD(
            candidatos=len(candidatos),
            anonimizados=0,
        )

    anonimizados = 0

    for atendimento in candidatos:
        imagens_removidas = True

        atendimento.descricao = None
        atendimento.parte_corpo = None
        atendimento.estilo = None
        atendimento.tamanho_cm = None
        atendimento.notas_privadas = "[anonimizado LGPD]"
        atendimento.datas_preferidas = None
        atendimento.horario_personalizado = None

        # Cliente pré-cadastrado automaticamente e sem nenhum outro atendimento:
        # anonimizar junto — o dado pessoal só existia por causa deste orçamento.
        if atendimento.cliente_id is not None:
            cliente = await session.get(Cliente, atendimento.cliente_id)
            if (
                cliente is not None
                and cliente.observacoes == MARCADOR_PRE_CADASTRO
            ):
                outros = await session.scalar(
                    select(func.count(Atendimento.id)).where(
                        Atendimento.cliente_id == cliente.id,
                        Atendimento.id != atendimento.id,
                    )
                )
                if not outros:
                    cliente.nome = "[anonimizado LGPD]"
                    cliente.telefone = None
                    cliente.instagram = None
                    cliente.email = None
                    cliente.observacoes = None
                    cliente.ativo = False

        for imagem in atendimento.imagens:
            caminho_original = imagem.imagem_path
            if caminho_original:
                removida = await _remover_imagem_atendimento(
                    atendimento, caminho_original
                )
                if removida:
                    imagem.imagem_path = "[anonimizado LGPD]"
                else:
                    imagens_removidas = False
            imagem.ativo = False

        if imagens_removidas:
            atendimento.lgpd_anonimizado_em = referencia
            anonimizados += 1

    await session.flush()

    return ResultadoAnonimizacaoLGPD(
        candidatos=len(candidatos),
        anonimizados=anonimizados,
    )
