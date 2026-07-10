# Fiscal — NFS-e e enquadramento (pendência de go-live)

> Item 1.6 das Recomendações Jurídicas (2026-07): antes de ligar `PAGAMENTOS_GO_LIVE`,
> alinhar com a contabilidade a emissão de NFS-e, CNAE, enquadramento e casos especiais.
> Documento enviado à contabilidade em 2026-07-10 (Word: "SessaoInk - Alinhamento Fiscal
> NFS-e - Contabilidade.docx"). Este arquivo registra os fatos do sistema e as decisões.

## Fatos do sistema (fonte de verdade)

- Empresa: VSTACK SOLUTIONS LTDA — CNPJ 40.204.602/0001-85 — Caieiras/SP.
- Catálogo de planos/preços: `backend/app/core/planos.py` (Essencial R$ 50, Profissional
  R$ 135 com promo R$ 100×6 meses, Avançado R$ 200; ciclos com desconto Pix −10/−15/−25%).
- Mensal = preapproval recorrente MP; trimestral/semestral/anual = cobrança única
  (Checkout Pro). Trial 14 dias sem cartão, sem conversão automática.
- Registro por pagamento (tabela `pagamentos`, `backend/app/models/saas.py`):
  `gateway_payment_id`, `valor_centavos`, `pago_em`, `payment_type`, plano/ciclo via
  `cobrancas`. **Fato gerador = pagamento aprovado.**
- Reembolso (CDC 7 dias) é manual no painel MP; webhook trata `refunded`/`charged_back`.

## Lacunas conhecidas (aguardando resposta da contabilidade)

1. **CPF/CNPJ do tomador não é coletado** — se a contabilidade confirmar obrigatoriedade,
   incluir campo no checkout antes do go-live (novo campo em `Estudio` ou no fluxo de
   `POST /pagamentos/checkout`).
2. CNAE/objeto social: confirmar se contempla SaaS (LC 116/2003 item 1.05 presumido).
3. Enquadramento Simples (Anexo III vs V / Fator R) — a definir pela contabilidade.
4. Momento de emissão (por pagamento vs competência) e base de cálculo (valor pago com
   desconto Pix; tratamento de juros de parcelamento).
5. Procedimento de cancelamento de nota em reembolso/estorno.
6. Emissão automatizada: verificar se a prefeitura de Caieiras/SP oferece API/lote.

## Decisões (preencher quando a contabilidade responder)

| Pergunta | Resposta | Data |
|---|---|---|
| CNAE ok / alterar? | — | — |
| Anexo Simples / Fator R | — | — |
| Código de serviço + alíquota ISS | — | — |
| Emissão: momento e base | — | — |
| CPF/CNPJ obrigatório no checkout? | — | — |
| Cancelamento de nota (reembolso) | — | — |
