# Política de Segurança — SessãoInk

## Reporte de vulnerabilidades

Se você encontrou uma vulnerabilidade de segurança no SessãoInk, por favor **não
abra uma issue pública**. Envie os detalhes em privado para:

**vsouz009@gmail.com** (assunto: `[SECURITY] SessãoInk`)

Inclua, se possível:
- descrição da vulnerabilidade e impacto potencial;
- passos para reproduzir;
- versão/URL afetada;
- qualquer evidência (logs, requests) com dados sensíveis **redigidos**.

Comprometemo-nos a:
- confirmar o recebimento em até **3 dias úteis**;
- dar um parecer inicial de severidade em até **7 dias**;
- manter você informado sobre a correção.

Pedimos que você:
- não acesse, modifique ou exfiltre dados de terceiros;
- não execute ataques de negação de serviço;
- dê um prazo razoável para correção antes de qualquer divulgação.

## Escopo

- Aplicação web: `https://sessao-ink.vercel.app`
- API: `https://sessaoink-api.fly.dev`

## Boas práticas internas (resumo)

Diretrizes completas de segurança, LGPD e PCI são mantidas em documento
interno do time. Em resumo: secrets nunca em código (somente em Fly/Vercel
secrets), MFA para administradores, autorização server-side por tenant, e
auditoria de eventos sensíveis.
