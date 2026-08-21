# Fiscal — NFS-e automática (estado e plano)

> Item 1.6 das Recomendações Jurídicas (2026-07): antes de ligar
> `PAGAMENTOS_GO_LIVE`, alinhar com a contabilidade a emissão de NFS-e, CNAE,
> enquadramento e casos especiais. Ofício enviado à contabilidade em 2026-07-10.
> **Atualizado em 2026-08-21** com a pesquisa de provedores e a fundação já
> implementada.

## Objetivo

Após o pagamento aprovado, o sistema deve emitir a NFS-e automaticamente e
enviar o documento por e-mail ao contratante, com o detalhamento da cobrança —
sem ação manual.

## O que JÁ está implementado (esta entrega)

| Peça | Onde |
|---|---|
| Coleta de CPF/CNPJ + razão social do contratante | `estudios.documento`, `estudios.razao_social` (migração `c9f1a2b3d4e5`) |
| Validação de CPF/CNPJ (com CNPJ alfanumérico, regra 2026) | `backend/app/core/documento_fiscal.py` |
| Bloqueio do checkout sem dados fiscais (422) | `backend/app/api/v1/pagamentos/router.py` — `campos_fiscais_faltando` |
| Modal que coleta os dados e repete o checkout sozinho | `frontend/src/components/assinatura/DadosFiscaisModal.tsx` |
| Comprovante de pagamento por e-mail, automático | `enviar_comprovante_pagamento` em `backend/app/core/email.py` |
| Anexo no e-mail (via para o PDF do DANFSe) | `_enviar_sync(..., anexos=...)` — parâmetro pronto, ainda sem PDF |
| **Garantia de envio único** | `cobrancas.comprovante_enviado_em` + `_reservar_comprovante` |
| Histórico de pagamentos (UI + API) | `GET /api/v1/pagamentos/historico` |

### Por que a guarda de envio único existe

A aprovação de pagamento chega por **três caminhos que podem rodar ao mesmo
tempo**: webhook `payment`, webhook `preapproval` e `POST /reconciliar` (o
frontend chama ao voltar do checkout — exatamente quando o webhook chega). O
dedup do inbox (`pagamento_eventos`) não cobre os três. `_reservar_comprovante`
faz um UPDATE condicional (`WHERE comprovante_enviado_em IS NULL`), então só uma
transação envia. Se o preparo falhar depois da reserva, ela é liberada para
permitir nova tentativa. Coberto por `backend/tests/integration/test_comprovante_pagamento.py`.

Endereço fiscal reutiliza os campos `endereco_*` do estúdio (já existiam).

## Decisão de provedor — recomendação: Focus NFe

Pesquisa de 2026-08-21. **Dois achados mudam o plano:**

1. **Resolução CGSN nº 191/2026 (DOU 10/08/2026)**: ME/EPP do Simples Nacional
   prestadoras de serviço passam a emitir **exclusivamente pelo Emissor Nacional
   a partir de 01/11/2026**. Sistemas municipais deixam de ser opção para o
   Simples. **Se a VSTACK for optante do Simples, integrar contra o sistema de
   Caieiras seria construir para jogar fora.**
2. **Nuvem Fiscal foi desativada em 31/07/2026** — fora de qualquer comparação.

| Provedor | Preço (baixo volume) | Caieiras | NFS-e Nacional | Sandbox |
|---|---|---|---|---|
| **Focus NFe** | **R$ 89,90/mês (100 notas) + R$ 0,10 excedente** | sim, homologado | sim (`/v2/nfsen`) | sim, 30 dias grátis |
| NFE.io | R$ 190/mês (250 notas) | página sem detalhe | sim | não divulgado |
| eNotas | API só a partir de R$ 247/mês | sim | sim | sim |
| PlugNotas | sob consulta | não verificado | sim | sim |
| Nuvem Fiscal | ❌ desativada em 31/07/2026 | — | — | — |

Focus NFe é o único que já cobre **Caieiras e o Emissor Nacional**, o que permite
atender a virada de 01/11/2026 trocando de endpoint em vez de fornecedor. Também
devolve o PDF do DANFSe pronto — relevante porque a **API oficial de geração do
DANFSe foi descontinuada em 01/07/2026** (quem integra direto no ADN passa a ter
que renderizar o próprio PDF).

Certificado digital: **não é exigido** no caminho municipal de Caieiras
(autenticação por token do portal), **é exigido** no Emissor Nacional — e-CNPJ
**A1** (arquivo, ~R$ 150–280/ano); A3 é token físico, inviável em servidor.

## Bloqueado — precisa de resposta da contabilidade

| Pergunta | Resposta | Data |
|---|---|---|
| **A empresa é optante do Simples?** (decide municipal vs Emissor Nacional) | — | — |
| CNAE contempla SaaS / licenciamento (LC 116 item 1.05)? | — | — |
| Anexo do Simples (III vs V) / Fator R | — | — |
| Código de serviço municipal + alíquota ISS | — | — |
| Emissão: por pagamento ou por competência mensal? (afeta os ciclos anuais) | — | — |
| Base de cálculo: valor pago com desconto Pix; juros de parcelamento entram? | — | — |
| Reembolso/estorno: cancelar nota ou emitir substitutiva? | — | — |
| Inscrição municipal ativa e acesso ao portal de Caieiras? | — | — |

Ações do usuário, independentes da contabilidade: contratar a Focus NFe (sandbox
grátis 30 dias) e gerar o token no portal da prefeitura.

## Fatos do sistema (base da emissão)

- Fonte de verdade de valores e datas: tabela `pagamentos` (`valor_centavos`,
  `pago_em`, `payment_type`) + `cobrancas` (plano, ciclo) + catálogo
  `backend/app/core/planos.py`.
- Fato gerador = pagamento aprovado e reconciliado.
- Mensal = preapproval recorrente; trimestral/semestral/anual = cobrança única do
  período (impacta a decisão competência vs caixa).
- Trial de 14 dias sem cartão e sem cobrança → sem nota.
- Reembolso é manual no painel MP; webhook trata `refunded`/`charged_back`.
- Cancelamento de NFS-e: até 5 dias úteis no padrão nacional (substituição em até
  90 dias), **vedado sem tomador identificado** — mais uma razão para o CPF/CNPJ.

## Próximo passo (quando destravar)

Plugar a emissão dentro de `_agendar_comprovante`
(`backend/app/api/v1/pagamentos/router.py`): emitir a nota no provedor, baixar o
PDF e passá-lo em `anexos` para `enviar_comprovante_pagamento`. A guarda de envio
único e todos os dados fiscais já estão no lugar; falta apenas a chamada ao
provedor. Manter a emissão assíncrona, idempotente e guardar XML + PDF por 5 anos.
