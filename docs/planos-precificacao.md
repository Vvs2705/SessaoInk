# Planos & Precificação — SessãoInk

> Estratégia de empacotamento validada para maximizar a adesão ao **plano
> intermediário (Profissional)**. Fonte da verdade do catálogo: `backend/app/core/planos.py`.

## Os 3 planos

| | **Essencial** | **Profissional** ⭐ | **Avançado** |
|---|---|---|---|
| Preço/mês | **R$ 50** | **R$ 135** (R$ 100 nos 1ºs 6 meses) | **R$ 200** |
| Para quem | Tatuador autônomo começando | Estúdio em crescimento | Estúdio estabelecido / multi-artista |
| Usuários | 1 | até 5 | ilimitado |
| Agenda / Clientes / Atendimentos | ✓ | ✓ | ✓ |
| Portal público (orçamento) | ✓ | ✓ | ✓ |
| Portfólio | até 30 fotos | ilimitado | ilimitado |
| Flash Arts (catálogo de vendas) | — | ✓ | ✓ |
| Financeiro | básico (entradas) | completo | completo |
| Estoque | — | ✓ | ✓ |
| Documentos/assinatura | até 10/mês | ilimitado | ilimitado |
| Relatórios | — | ✓ | ✓ avançado + exportação |
| Auditoria/segurança | — | ✓ | ✓ |
| Armazenamento de mídia | 1 GB | 10 GB | 50 GB |
| Suporte | e-mail | prioritário | prioritário + onboarding |

## Por que essa divisão vende o Profissional

1. **Âncora alta:** o Avançado (R$200) faz o R$135 parecer o "meio-termo inteligente".
2. **Essencial intencionalmente limitado:** 1 usuário, sem financeiro completo, sem
   relatórios e sem flash arts. Qualquer estúdio com >1 pessoa **precisa** subir.
3. **Gatilhos naturais de upgrade** (Essencial → Profissional): contratar um segundo
   artista/recepcionista, querer relatórios, vender flash arts, controlar estoque.
4. **"Mais popular"** no Profissional reduz a carga de decisão (prova social).
5. **Promoção de entrada:** R$100/mês nos primeiros 6 meses **só no Profissional** —
   diminui a fricção de começar já no plano que retém melhor.

## Mecânica da promoção (intro price)
- Aplica-se a quem **assina o Profissional** (novo cliente).
- Preço promocional: **R$ 100/mês por 6 meses**; depois **R$ 135/mês** automático.
- No Stripe: implementar como *coupon* (`percent_off`/`amount_off` com `duration=repeating`,
  `duration_in_months=6`) aplicado ao price do Profissional, OU um price de intro dedicado.
- Comunicar com clareza no checkout: "R$100/mês nos 6 primeiros meses, depois R$135/mês".

## Trial
- **14 dias grátis** no Profissional (sem cartão) é o caminho recomendado para conversão.
  O modelo `Assinatura` já tem `status=TRIAL` e `trial_expira_em`.

## Recomendações extras (opcionais)
- **Anual com ~2 meses grátis** (ex.: Profissional anual = R$1.350 ≈ 10× mensal).
- **Garantia de 7 dias** para reduzir risco percebido.
- Revisar limites após 2–3 meses de uso real (dados de PostHog) e ajustar.

## Enforcement dos limites (entitlements)
- Os limites vivem em `planos.limites` (JSON) e em `app/core/planos.py`.
- Regra de produto: ao atingir um limite (ex.: 6º usuário no Profissional, 31ª foto no
  Essencial), bloquear com mensagem clara de upgrade — **não** falhar silenciosamente.
- Implementar checagem central (helper `entitlements`) conforme o billing for ligado.

## Pendente de você (à noite)
- Conta **Stripe** + `STRIPE_SECRET_KEY` + webhook secret → eu ligo o checkout/cobrança.
- Confirmar os textos finais de cada plano (posso sugerir copy).
