# Go-live de pagamentos — SessãoInk (Mercado Pago)

Checklist obrigatório antes de habilitar cobrança real. Ligar `PAGAMENTOS_GO_LIVE=true`
cobra dinheiro de verdade — só faça com confirmação explícita do dono do produto.

> A trava é dupla: enquanto `PAGAMENTOS_GO_LIVE=false`, `POST /api/v1/pagamentos/checkout`
> responde **503** (nenhuma cobrança é criada). Ao ligar em produção, o startup **aborta**
> se qualquer pré-condição abaixo faltar (`erros_go_live` em `app/core/config.py`).

## Pré-condições técnicas (validadas no startup e por `scripts/check_go_live.py`)

- [ ] `MERCADO_PAGO_ACCESS_TOKEN` configurado (Fly secret).
- [ ] `MERCADO_PAGO_PUBLIC_KEY` configurada.
- [ ] `MERCADO_PAGO_WEBHOOK_SECRET` configurado — **sem ele o webhook seria permissivo**.
- [ ] `APP_URL` com HTTPS (usado em `back_urls`/`notification_url`).
- [ ] `CSRF_STRICT_MODE=true`.
- [ ] `SENTRY_DSN` configurado (observabilidade da cobrança).
- [ ] `INTERNAL_PROXY_SECRET` configurado no Fly **e** na Vercel (anti-spoofing de IP).

## Verificação pré-deploy

```bash
# Com as envs/secrets de produção carregadas:
cd backend && python scripts/check_go_live.py
# ou via Fly:
fly ssh console -C "python scripts/check_go_live.py"
```

Exit code 0 = pronto. Qualquer FAIL bloqueia o go-live.

## Sandbox antes da produção

- [ ] Webhook de produção configurado no painel do Mercado Pago apontando para
      `https://sessaoink-api.fly.dev/api/v1/pagamentos/webhook`.
- [ ] Teste em sandbox: checkout Pix + cartão, webhook recebido, assinatura ativada
      apenas após reconciliação (`obter_pagamento` → status `approved`).
- [ ] Teste de webhook duplicado → resposta `duplicado` (idempotente, sem reprocessar).
- [ ] Teste de webhook com assinatura inválida → **401**.

## Ligar a cobrança (passo final — requer confirmação do dono)

```bash
fly secrets set PAGAMENTOS_GO_LIVE=true --app sessaoink-api
# o release_command valida o startup; se faltar pré-condição, o deploy aborta
# sem downtime (versão anterior segue no ar).
```

## Rollback

```bash
fly secrets set PAGAMENTOS_GO_LIVE=false --app sessaoink-api
```

Volta o checkout para 503 imediatamente. Nenhuma nova cobrança é criada.

## Dados que NUNCA trafegam/são gravados (PCI — escopo SAQ-A)

PAN completo, CVV/CVC, senha de cartão, trilha magnética. O backend só recebe o
fluxo de Checkout Pro (preference/init_point) — a tokenização do cartão acontece
no Mercado Pago, não no SessãoInk.
