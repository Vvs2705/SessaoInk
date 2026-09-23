"""Serviço de envio de email via Resend (resend.com).

Funciona apenas se RESEND_API_KEY estiver configurado nas variáveis de ambiente.
Caso contrário, a operação é silenciosa (no-op).
"""

import asyncio
import logging
from html import escape

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resend_configurado() -> bool:
    return bool(settings.RESEND_API_KEY)


def _enviar_sync(
    destinatario: str,
    assunto: str,
    html: str,
    anexos: list[dict] | None = None,
) -> None:
    """Envia email via Resend de forma síncrona — executado em thread separada.

    `anexos`: lista no formato do Resend — {"filename": str, "content": <base64>}.
    Usado para anexar o PDF da nota fiscal (DANFSe) ao comprovante.
    """
    import resend  # type: ignore[import-untyped]  # lazy: módulo importável sem o pacote

    resend.api_key = settings.RESEND_API_KEY

    payload: dict = {
        "from": settings.RESEND_FROM,
        "to": [destinatario],
        "subject": assunto,
        "html": html,
    }
    if anexos:
        payload["attachments"] = anexos

    resend.Emails.send(payload)


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
        logger.info(f"Email de orçamento enviado via Resend (protocolo {protocolo})")
    except Exception as exc:
        # Não deixar falha de email derrubar a requisição
        logger.warning(f"Falha ao enviar email via Resend: {exc}")


async def enviar_codigo_mfa(email_destino: str, nome: str, codigo: str) -> bool:
    """Envia o código OTP de verificação em dois fatores. Retorna True se enviado.

    Sem RESEND configurado, registra no log (não falha o fluxo de login) e retorna False —
    o caller decide como sinalizar ao usuário.
    """
    if not _resend_configurado():
        logger.info("mfa_otp_email_sem_resend", extra={"extra": {"email": email_destino}})
        return False

    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#2F9285;padding:22px 30px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk · Segurança</p>
      <h1 style="margin:6px 0 0;font-size:19px;color:#050B12;font-weight:800;">Seu código de verificação</h1>
    </div>
    <div style="padding:28px 30px;">
      <p style="margin:0 0 16px;font-size:14px;color:#F0EADD;line-height:1.6;">Olá {nome}, use o código abaixo para concluir seu login. Ele expira em 5 minutos.</p>
      <div style="text-align:center;margin:18px 0;">
        <span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#2F9285;background:#050B12;border:1px solid #243337;border-radius:14px;padding:16px 24px;">{codigo}</span>
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#87938F;line-height:1.6;">Se você não tentou entrar, ignore este e-mail e considere trocar sua senha.</p>
    </div>
  </div>
</body></html>
"""
    try:
        await asyncio.to_thread(
            _enviar_sync, email_destino, "[SessãoInk] Seu código de verificação", html
        )
        logger.info("Código MFA enviado via Resend")
        return True
    except Exception as exc:
        logger.warning(f"Falha ao enviar código MFA via Resend: {exc}")
        return False


async def enviar_lead_interesse_plano(
    nome: str,
    contato: str,
    plano: str,
    ciclo: str,
    mensagem: str | None = None,
) -> None:
    """Notifica o time de vendas sobre um interesse em plano (captura de lead).

    Destino: settings.LEADS_EMAIL. Se ausente/sem Resend, apenas registra no log
    (o lead nunca é perdido silenciosamente — fica no log estruturado).
    """
    destino = settings.LEADS_EMAIL
    if not destino or not _resend_configurado():
        logger.info(
            "lead_interesse_plano",
            extra={"extra": {"plano": plano, "ciclo": ciclo}},
        )
        return

    msg_html = (mensagem or "—").replace("<", "&lt;").replace(">", "&gt;")
    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#2F9285;padding:22px 30px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk · Vendas</p>
      <h1 style="margin:6px 0 0;font-size:19px;color:#050B12;font-weight:800;">Novo interesse no plano {plano} 🚀</h1>
    </div>
    <div style="padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:12px;color:#87938F;width:30%;">Nome</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;font-weight:600;">{nome}</td></tr>
        <tr style="border-top:1px solid #1a2830;"><td style="padding:6px 0;font-size:12px;color:#87938F;">Contato</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;">{contato}</td></tr>
        <tr style="border-top:1px solid #1a2830;"><td style="padding:6px 0;font-size:12px;color:#87938F;">Plano</td><td style="padding:6px 0;font-size:14px;color:#2F9285;font-weight:700;">{plano}</td></tr>
        <tr style="border-top:1px solid #1a2830;"><td style="padding:6px 0;font-size:12px;color:#87938F;">Ciclo</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;">{ciclo}</td></tr>
      </table>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #243337;">
        <p style="margin:0 0 6px;font-size:12px;color:#87938F;">Mensagem</p>
        <p style="margin:0;font-size:14px;color:#F0EADD;line-height:1.6;">{msg_html}</p>
      </div>
    </div>
  </div>
</body></html>
"""
    assunto = f"[SessãoInk] Interesse no plano {plano} ({ciclo}) — {nome}"
    try:
        await asyncio.to_thread(_enviar_sync, destino, assunto, html)
        logger.info(f"Lead de interesse enviado (plano {plano})")
    except Exception as exc:
        logger.warning(f"Falha ao enviar lead via Resend: {exc}")


async def enviar_solicitacao_exclusao_lgpd(
    titular_nome: str,
    titular_email: str,
    estudio_nome: str | None,
) -> None:
    """Notifica o operador sobre uma solicitação de exclusão de dados (LGPD art. 18, VI).

    Destino: settings.LEADS_EMAIL (caixa do operador). Sem Resend/destino, apenas
    registra no log — a solicitação nunca se perde (também fica na auditoria).
    O log NÃO carrega PII (o titular já está identificado no e-mail e na auditoria).
    """
    destino = settings.LEADS_EMAIL
    if not destino or not _resend_configurado():
        logger.info("lgpd_exclusao_solicitada")
        return

    nome_html = titular_nome.replace("<", "&lt;").replace(">", "&gt;")
    email_html = titular_email.replace("<", "&lt;").replace(">", "&gt;")
    estudio_html = (estudio_nome or "—").replace("<", "&lt;").replace(">", "&gt;")
    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#B4534F;padding:22px 30px;">
      <p style="margin:0;font-size:11px;color:#F0EADD;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk · LGPD</p>
      <h1 style="margin:6px 0 0;font-size:19px;color:#F0EADD;font-weight:800;">Solicitação de exclusão de dados</h1>
    </div>
    <div style="padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:12px;color:#87938F;width:30%;">Titular</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;font-weight:600;">{nome_html}</td></tr>
        <tr style="border-top:1px solid #1a2830;"><td style="padding:6px 0;font-size:12px;color:#87938F;">E-mail</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;">{email_html}</td></tr>
        <tr style="border-top:1px solid #1a2830;"><td style="padding:6px 0;font-size:12px;color:#87938F;">Estúdio</td><td style="padding:6px 0;font-size:14px;color:#F0EADD;">{estudio_html}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#87938F;line-height:1.6;">Processe dentro do prazo legal, preservando os dados com obrigação legal/fiscal de guarda (art. 16 LGPD).</p>
    </div>
  </div>
</body></html>
"""
    assunto = "[SessãoInk] Solicitação de exclusão de dados (LGPD)"
    try:
        await asyncio.to_thread(_enviar_sync, destino, assunto, html)
        logger.info("lgpd_exclusao_solicitada_enviada")
    except Exception as exc:
        logger.warning(f"Falha ao enviar solicitação de exclusão via Resend: {exc}")


async def enviar_convite_equipe(
    email_destino: str,
    nome_estudio: str,
    nome_convidante: str,
    papel: str,
    convite_url: str,
) -> bool:
    """Envia o convite para um novo membro entrar no estúdio.

    Sem RESEND configurado, registra no log e retorna False — o ADMIN ainda
    consegue compartilhar o link manualmente (a UI mostra o link copiável).
    """
    if not _resend_configurado():
        logger.info(
            "convite_equipe_email_sem_resend",
            extra={"extra": {"email": email_destino, "convite_url": convite_url}},
        )
        return False

    papel_label = {"ARTISTA": "Artista", "RECEPCIONISTA": "Recepção"}.get(papel, papel)

    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#2F9285;padding:24px 32px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#050B12;font-weight:800;">Você foi convidado(a) para o estúdio 🎨</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 18px;font-size:14px;color:#87938F;line-height:1.6;">
        <strong style="color:#F0EADD;">{nome_convidante}</strong> convidou você para fazer parte do estúdio
        <strong style="color:#F0EADD;">{nome_estudio}</strong> no SessãoInk, com o papel de
        <strong style="color:#2F9285;">{papel_label}</strong>.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#87938F;line-height:1.6;">
        Clique no botão abaixo para criar sua conta e acessar a plataforma. Este convite expira em 7 dias.
      </p>
      <a href="{convite_url}"
         style="display:inline-block;background:#2F9285;color:#050B12;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;text-decoration:none;">
        Aceitar convite e criar conta →
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#87938F;line-height:1.5;">
        Se você não esperava este convite, pode ignorar este e-mail com segurança.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1a2830;text-align:center;">
      <p style="margin:0;font-size:11px;color:#87938F;">SessãoInk · Gestão para tatuadores</p>
    </div>
  </div>
</body></html>
"""
    try:
        await asyncio.to_thread(
            _enviar_sync,
            email_destino,
            f"[SessãoInk] Convite para o estúdio {nome_estudio}",
            html,
        )
        logger.info("Convite de equipe enviado")
        return True
    except Exception as exc:
        logger.warning(f"Falha ao enviar convite de equipe: {exc}")
        return False


async def enviar_boas_vindas(
    destinatario_email: str,
    nome: str,
    nome_estudio: str,
    slug: str,
) -> None:
    """E-mail acolhedor de boas-vindas após o cadastro self-serve.

    Sem RESEND configurado, é um no-op silencioso (só log, sem PII) — o cadastro
    não depende deste e-mail.
    """
    if not _resend_configurado():
        logger.debug("RESEND_API_KEY não configurado — e-mail de boas-vindas ignorado.")
        return

    nome_html = nome.replace("<", "&lt;").replace(">", "&gt;")
    estudio_html = nome_estudio.replace("<", "&lt;").replace(">", "&gt;")
    portal_url = f"{settings.APP_URL}/{slug}"
    painel_url = f"{settings.APP_URL}/atendimentos"

    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#2F9285;padding:24px 32px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#050B12;font-weight:800;">Bem-vindo(a) ao SessãoInk! 🎨</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 18px;font-size:14px;color:#87938F;line-height:1.6;">
        Olá, <strong style="color:#F0EADD;">{nome_html}</strong>! O estúdio
        <strong style="color:#F0EADD;">{estudio_html}</strong> já está no ar.
        Seu <strong style="color:#2F9285;">trial de 14 dias</strong> começou agora — aproveite todos os recursos sem compromisso.
      </p>

      <p style="margin:0 0 12px;font-size:13px;color:#F0EADD;font-weight:700;">Seus 3 primeiros passos:</p>
      <div style="background:#050B12;border:1px solid #243337;border-radius:14px;padding:8px 20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0;font-size:16px;color:#2F9285;font-weight:800;width:32px;vertical-align:top;">1</td>
            <td style="padding:12px 0;font-size:14px;color:#F0EADD;line-height:1.5;">
              <strong>Cadastre seus clientes</strong><br>
              <span style="color:#87938F;font-size:13px;">Centralize contatos e histórico em um só lugar.</span>
            </td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:12px 0;font-size:16px;color:#2F9285;font-weight:800;vertical-align:top;">2</td>
            <td style="padding:12px 0;font-size:14px;color:#F0EADD;line-height:1.5;">
              <strong>Configure seu portal público</strong><br>
              <span style="color:#87938F;font-size:13px;">Ele já está no ar em <a href="{portal_url}" style="color:#2F9285;text-decoration:none;">{portal_url}</a> — personalize e divulgue.</span>
            </td>
          </tr>
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:12px 0;font-size:16px;color:#2F9285;font-weight:800;vertical-align:top;">3</td>
            <td style="padding:12px 0;font-size:14px;color:#F0EADD;line-height:1.5;">
              <strong>Crie seu primeiro orçamento</strong><br>
              <span style="color:#87938F;font-size:13px;">Envie propostas profissionais em minutos.</span>
            </td>
          </tr>
        </table>
      </div>

      <a href="{painel_url}"
         style="display:inline-block;background:#2F9285;color:#050B12;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;text-decoration:none;">
        Acessar o painel →
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#87938F;line-height:1.5;">
        Precisa de ajuda? É só responder este e-mail. Boas tatuagens! 🖤
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1a2830;text-align:center;">
      <p style="margin:0;font-size:11px;color:#87938F;">SessãoInk · Gestão para tatuadores</p>
    </div>
  </div>
</body></html>
"""
    try:
        await asyncio.to_thread(
            _enviar_sync,
            destinatario_email,
            "[SessãoInk] Bem-vindo(a)! Seu estúdio está no ar 🎨",
            html,
        )
        logger.info("E-mail de boas-vindas enviado via Resend")
    except Exception as exc:
        logger.warning(f"Falha ao enviar e-mail de boas-vindas via Resend: {exc}")


async def enviar_email_reset_senha(
    email_destino: str,
    nome: str,
    reset_url: str,
) -> bool:
    """Envia e-mail com link de redefinição de senha."""
    if not _resend_configurado():
        logger.info(
            "reset_senha_email_sem_resend",
            extra={"extra": {"email": email_destino, "reset_url": reset_url}},
        )
        return False

    html = f"""
    <div style="font-family:Arial,sans-serif;background:#050B12;color:#F0EADD;padding:32px">
      <div style="max-width:560px;margin:0 auto;background:#0B171C;border:1px solid #243337;border-radius:24px;padding:28px">
        <p style="color:#2F9285;font-weight:700;letter-spacing:.12em;text-transform:uppercase">SessãoInk</p>
        <h1 style="margin:0 0 12px;font-size:24px">Redefinição de senha</h1>
        <p style="color:#87938F;line-height:1.6">Olá {nome}, recebemos uma solicitação para redefinir sua senha.</p>
        <p style="color:#87938F;line-height:1.6">O link abaixo expira em 30 minutos.</p>
        <p style="margin:28px 0">
          <a href="{reset_url}" style="background:#2F9285;color:#050B12;padding:14px 18px;border-radius:14px;text-decoration:none;font-weight:700">
            Criar nova senha
          </a>
        </p>
        <p style="color:#87938F;font-size:13px;line-height:1.6">
          Se você não solicitou essa alteração, ignore este e-mail.
        </p>
      </div>
    </div>
    """

    try:
        await asyncio.to_thread(
            _enviar_sync,
            email_destino,
            "[SessãoInk] Redefinição de senha",
            html,
        )
        logger.info("Email de reset enviado")
        return True
    except Exception as exc:
        logger.warning(f"Falha ao enviar email de reset: {exc}")
        return False


def _linha_comprovante(rotulo: str, valor: str, destaque: bool = False) -> str:
    cor = "#2F9285" if destaque else "#F0EADD"
    peso = "800" if destaque else "600"
    return f"""
          <tr style="border-top:1px solid #1a2830;">
            <td style="padding:11px 0;font-size:13px;color:#87938F;">{escape(rotulo)}</td>
            <td style="padding:11px 0;font-size:13px;color:{cor};font-weight:{peso};text-align:right;">{escape(valor)}</td>
          </tr>"""


async def enviar_comprovante_pagamento(
    destinatario_email: str,
    nome_estudio: str,
    razao_social: str | None,
    documento_formatado: str | None,
    plano_nome: str,
    ciclo: str,
    valor_formatado: str,
    data_formatada: str,
    meio_pagamento: str | None,
    referencia: str,
    periodo_texto: str | None = None,
    anexos: list[dict] | None = None,
) -> None:
    """Comprovante de pagamento da assinatura, enviado após aprovação.

    `anexos` recebe o PDF da NFS-e (DANFSe) quando a emissão automática estiver
    ligada; até lá o comprovante vai sozinho. Ver docs/fiscal-nfse.md.
    """
    if not _resend_configurado():
        logger.debug("RESEND_API_KEY não configurado — comprovante ignorado.")
        return

    linhas = _linha_comprovante("Plano", f"{plano_nome} · {ciclo.capitalize()}")
    if periodo_texto:
        linhas += _linha_comprovante("Período", periodo_texto)
    linhas += _linha_comprovante("Data do pagamento", data_formatada)
    if meio_pagamento:
        linhas += _linha_comprovante("Forma de pagamento", meio_pagamento)
    if razao_social:
        linhas += _linha_comprovante("Contratante", razao_social)
    if documento_formatado:
        linhas += _linha_comprovante("CPF/CNPJ", documento_formatado)
    linhas += _linha_comprovante("Valor pago", valor_formatado, destaque=True)

    nota = (
        "A nota fiscal segue anexa a este e-mail."
        if anexos
        else "A nota fiscal referente a este pagamento será enviada em seguida."
    )
    painel_url = f"{settings.APP_URL}/configuracoes?assinatura=1"

    html = f"""
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050B12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0B171C;border:1px solid #243337;border-radius:18px;overflow:hidden;">
    <div style="background:#2F9285;padding:24px 32px;">
      <p style="margin:0;font-size:11px;color:#050B12;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SessãoInk</p>
      <h1 style="margin:8px 0 0;font-size:20px;color:#050B12;font-weight:800;">Pagamento confirmado</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 20px;font-size:14px;color:#87938F;line-height:1.6;">
        Recebemos o pagamento da assinatura de
        <strong style="color:#F0EADD;">{escape(nome_estudio)}</strong>. Obrigado!
      </p>

      <div style="background:#050B12;border:1px solid #243337;border-radius:14px;padding:4px 20px;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;">{linhas}
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:12px;color:#87938F;line-height:1.6;">
        {nota}<br>
        Referência da transação: <span style="color:#F0EADD;">{escape(referencia)}</span>
      </p>

      <a href="{painel_url}"
         style="display:inline-block;background:#2F9285;color:#050B12;font-weight:700;font-size:14px;padding:13px 28px;border-radius:12px;text-decoration:none;">
        Ver minha assinatura →
      </a>

      <p style="margin:24px 0 0;font-size:12px;color:#87938F;line-height:1.5;">
        Dúvidas sobre a cobrança? É só responder este e-mail.
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #1a2830;text-align:center;">
      <p style="margin:0;font-size:11px;color:#87938F;">SessãoInk · Gestão para tatuadores</p>
    </div>
  </div>
</body></html>
"""
    try:
        await asyncio.to_thread(
            _enviar_sync,
            destinatario_email,
            f"[SessãoInk] Comprovante de pagamento — {valor_formatado}",
            html,
            anexos,
        )
        logger.info("comprovante_pagamento_enviado", extra={"extra": {"ref": referencia}})
    except Exception as exc:
        logger.warning(f"Falha ao enviar comprovante de pagamento: {exc}")
