"""Serviço de envio de email via Resend (resend.com).

Funciona apenas se RESEND_API_KEY estiver configurado nas variáveis de ambiente.
Caso contrário, a operação é silenciosa (no-op).
"""

import asyncio
import logging
import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resend_configurado() -> bool:
    return bool(settings.RESEND_API_KEY)


def _enviar_sync(destinatario: str, assunto: str, html: str) -> None:
    """Envia email via Resend de forma síncrona — executado em thread separada."""
    resend.api_key = settings.RESEND_API_KEY

    resend.Emails.send({
        "from": settings.RESEND_FROM,
        "to": [destinatario],
        "subject": assunto,
        "html": html,
    })


async def enviar_notificacao_orcamento(
    email_destino: str,
    nome_estudio: str,
    slug: str,
    protocolo: str,
    nome_cliente: str,
    whatsapp: str,
    descricao: str | None,
    estilo: str | None,
    parte_corpo: str | None,
) -> None:
    """Envia email de notificação de novo orçamento para o estúdio."""
    if not _resend_configurado():
        logger.debug("RESEND_API_KEY não configurado — email de notificação ignorado.")
        return

    dashboard_url = f"{settings.APP_URL}/atendimentos"
    descricao_html = descricao or "<em>(não informada)</em>"
    estilo_html = estilo or "—"
    parte_html = parte_corpo or "—"

    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#2F9285;padding:24px 32px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#050B12;font-weight:800;">
        Novo pedido de orçamento! 🎨
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;font-size:14px;color:#87938F;line-height:1.6;">
        Olá, <strong style="color:#F0EADD;">{nome_estudio}</strong>!<br>
        Um novo cliente preencheu o formulário de orçamento do seu portal público.
      </p>

      <!-- Info card -->
      <div style="background:#050B12;border:1px solid #243337;border-radius:14px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:7px 0;font-size:12px;color:#87938F;width:42%;">Protocolo</td>
            <td style="padding:7px 0;font-size:14px;color:#2F9285;font-weight:700;font-family:monospace;">{protocolo}</td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:7px 0;font-size:12px;color:#87938F;">Nome</td>
            <td style="padding:7px 0;font-size:14px;color:#F0EADD;font-weight:600;">{nome_cliente}</td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:7px 0;font-size:12px;color:#87938F;">WhatsApp</td>
            <td style="padding:7px 0;font-size:14px;color:#F0EADD;">{whatsapp}</td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:7px 0;font-size:12px;color:#87938F;">Estilo</td>
            <td style="padding:7px 0;font-size:14px;color:#F0EADD;">{estilo_html}</td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:7px 0;font-size:12px;color:#87938F;">Parte do corpo</td>
            <td style="padding:7px 0;font-size:14px;color:#F0EADD;">{parte_html}</td>
          </tr>
        </table>

        <div style="margin-top:14px;padding-top:14px;border-top:1px solid #243337;">
          <p style="margin:0 0 6px;font-size:12px;color:#87938F;">Descrição do pedido</p>
          <p style="margin:0;font-size:14px;color:#F0EADD;line-height:1.6;">{descricao_html}</p>
        </div>
      </div>

      <!-- CTA -->
      <a href="{dashboard_url}"
         style="display:inline-block;background:#2F9285;color:#050B12;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;text-decoration:none;letter-spacing:0.2px;">
        Ver atendimento no painel →
      </a>

      <p style="margin:28px 0 0;font-size:12px;color:#87938F;line-height:1.5;">
        Este email foi gerado automaticamente porque seu portal
        <strong style="color:#F0EADD;">sessao-ink.vercel.app/{slug}</strong>
        recebeu uma nova solicitação.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #1a2830;text-align:center;">
      <p style="margin:0;font-size:11px;color:#87938F;">
        SessãoInk · Gestão para tatuadores
      </p>
    </div>
  </div>
</body>
</html>
"""

    assunto = f"[SessãoInk] Novo orçamento de {nome_cliente} — {protocolo}"
    try:
        await asyncio.to_thread(_enviar_sync, email_destino, assunto, html)
        logger.info(f"Email enviado via Resend para {email_destino} (protocolo {protocolo})")
    except Exception as exc:
        # Não deixar falha de email derrubar a requisição
        logger.warning(f"Falha ao enviar email via Resend: {exc}")
