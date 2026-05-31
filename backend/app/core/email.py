"""Serviço de envio de email via SMTP (stdlib).

Funciona apenas se SMTP_HOST, SMTP_USER e SMTP_PASSWORD estiverem configurados
nas variáveis de ambiente. Caso contrário, a operação é silenciosa (no-op).
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configurado() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def _enviar_sync(destinatario: str, assunto: str, html: str) -> None:
    """Envia email de forma síncrona — executado em thread separada."""
    remetente = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = remetente
    msg["To"] = destinatario
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(remetente, [destinatario], msg.as_string())


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
    if not _smtp_configurado():
        logger.debug("SMTP não configurado — email de notificação ignorado.")
        return

    dashboard_url = f"{settings.APP_URL}/atendimentos"
    descricao_html = descricao or "<em>(não informada)</em>"
    estilo_html = estilo or "—"
    parte_html = parte_corpo or "—"

    html = f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#2F9285;padding:24px 32px;">
      <p style="margin:0;font-size:12px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#050B12;font-weight:800;">
        Novo pedido de orçamento! 🎨
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;font-size:14px;color:#87938F;line-height:1.6;">
        Olá, <strong style="color:#F0EADD;">{nome_estudio}</strong>!<br>
        Um novo cliente preencheu o formulário de orçamento do seu portal.
      </p>

      <!-- Info card -->
      <div style="background:#050B12;border:1px solid #243337;border-radius:14px;padding:20px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;font-size:12px;color:#87938F;width:40%;">Protocolo</td>
              <td style="padding:6px 0;font-size:14px;color:#2F9285;font-weight:700;font-family:monospace;">{protocolo}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#87938F;">Cliente</td>
              <td style="padding:6px 0;font-size:14px;color:#F0EADD;font-weight:600;">{nome_cliente}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#87938F;">WhatsApp</td>
              <td style="padding:6px 0;font-size:14px;color:#F0EADD;">{whatsapp}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#87938F;">Estilo</td>
              <td style="padding:6px 0;font-size:14px;color:#F0EADD;">{estilo_html}</td></tr>
          <tr><td style="padding:6px 0;font-size:12px;color:#87938F;">Parte do corpo</td>
              <td style="padding:6px 0;font-size:14px;color:#F0EADD;">{parte_html}</td></tr>
        </table>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #243337;">
          <p style="margin:0 0 4px;font-size:12px;color:#87938F;">Descrição</p>
          <p style="margin:0;font-size:14px;color:#F0EADD;line-height:1.5;">{descricao_html}</p>
        </div>
      </div>

      <!-- CTA -->
      <a href="{dashboard_url}"
         style="display:inline-block;background:#2F9285;color:#050B12;font-weight:700;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
        Ver no painel →
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#87938F;">
        Este email foi enviado porque seu portal <strong>sessao-ink.vercel.app/{slug}</strong> recebeu uma nova solicitação.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #243337;text-align:center;">
      <p style="margin:0;font-size:11px;color:#87938F;">SessãoInk · Gestão para tatuadores</p>
    </div>
  </div>
</body>
</html>
"""

    assunto = f"[SessãoInk] Novo orçamento de {nome_cliente} — {protocolo}"
    try:
        await asyncio.to_thread(_enviar_sync, email_destino, assunto, html)
        logger.info(f"Email de notificação enviado para {email_destino} (protocolo {protocolo})")
    except Exception as exc:
        # Não deixar falha de email derrubar a requisição
        logger.warning(f"Falha ao enviar email de notificação: {exc}")
