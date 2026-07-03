import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Política de Privacidade — SessãoInk",
  description:
    "Como o SessãoInk coleta, usa, compartilha e protege dados pessoais, em conformidade com a LGPD.",
};

export default function PoliticaPrivacidadePage() {
  return (
    <LegalDocument
      titulo="Política de Privacidade"
      vigencia="2 de julho de 2026"
      versao="2026-07-02"
    >
      <p>
        Esta Política de Privacidade descreve como a{" "}
        <strong className="text-porcelain-ink">
          VSTACK SOLUTIONS LTDA, inscrita no CNPJ nº 40.204.602/0001-85
        </strong>{" "}
        (&ldquo;SessãoInk&rdquo;, &ldquo;nós&rdquo;), com sede na{" "}
        <strong className="text-porcelain-ink">
          Rua Vicente Lisa, nº 6281, Vila Rosina, Caieiras/SP, CEP 07749-220
        </strong>
        , trata dados pessoais no âmbito da plataforma SessãoInk, em conformidade
        com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais —
        &ldquo;LGPD&rdquo;).
      </p>

      <LegalSection titulo="1. Papéis: controlador e operador">
        <p>
          A SessãoInk atua em dois papéis distintos:
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong className="text-porcelain-ink">Controladora</strong> dos dados
            da <em>conta</em> (dono e equipe do estúdio): nome, e-mail, credenciais e
            registros de uso da plataforma.
          </li>
          <li>
            <strong className="text-porcelain-ink">Operadora</strong> dos dados que o
            estúdio cadastra sobre <em>seus próprios clientes</em> (nome, contato,
            histórico de atendimentos, imagens). Nesse caso, o{" "}
            <strong className="text-porcelain-ink">estúdio é o controlador</strong> e
            a SessãoInk trata esses dados seguindo as instruções do estúdio.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="2. Dados que coletamos">
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong className="text-porcelain-ink">Dados de cadastro:</strong> nome,
            e-mail e senha (armazenada apenas como hash criptográfico).
          </li>
          <li>
            <strong className="text-porcelain-ink">Dados do estúdio:</strong> nome,
            endereço, contatos e informações do portfólio público.
          </li>
          <li>
            <strong className="text-porcelain-ink">Dados de uso e segurança:</strong>{" "}
            endereço IP, registros de acesso e auditoria, para segurança e prevenção
            a fraudes.
          </li>
          <li>
            <strong className="text-porcelain-ink">Dados de clientes do estúdio</strong>{" "}
            (na condição de operadora): informações inseridas pelo estúdio sobre seus
            clientes e atendimentos.
          </li>
          <li>
            <strong className="text-porcelain-ink">Dados de pagamento:</strong> não
            armazenamos dados de cartão. Os pagamentos são processados diretamente
            pelo Mercado Pago; recebemos apenas a confirmação e metadados da transação.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="3. Finalidades e bases legais">
        <p>Tratamos dados pessoais para as seguintes finalidades:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Fornecer e operar a plataforma — base legal: execução de contrato (art.
            7º, V).
          </li>
          <li>
            Autenticação, segurança, prevenção a fraudes e cumprimento de obrigações
            legais — base legal: legítimo interesse e obrigação legal (art. 7º, II e IX).
          </li>
          <li>
            Cobrança e faturamento — base legal: execução de contrato e obrigação legal.
          </li>
          <li>
            Comunicações operacionais (e-mails transacionais) — base legal: execução
            de contrato e legítimo interesse.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="4. Compartilhamento com operadores (terceiros)">
        <p>
          Para operar a plataforma, compartilhamos dados com prestadores de serviço
          que atuam como operadores, exclusivamente nas finalidades acima:
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong className="text-porcelain-ink">Mercado Pago</strong> — processamento
            de pagamentos.
          </li>
          <li>
            <strong className="text-porcelain-ink">Resend</strong> — envio de e-mails
            transacionais.
          </li>
          <li>
            <strong className="text-porcelain-ink">Sentry</strong> — monitoramento de
            erros (com dados pessoais removidos antes do envio).
          </li>
          <li>
            <strong className="text-porcelain-ink">PostHog</strong> — métricas de uso
            do produto.
          </li>
          <li>
            <strong className="text-porcelain-ink">Cloudflare R2</strong> — armazenamento
            de arquivos e imagens.
          </li>
          <li>
            <strong className="text-porcelain-ink">Vercel</strong> e{" "}
            <strong className="text-porcelain-ink">Fly.io</strong> — hospedagem da
            aplicação.
          </li>
        </ul>
        <p className="text-xs">
          Não vendemos dados pessoais e não os compartilhamos para fins de publicidade
          de terceiros.
        </p>
      </LegalSection>

      <LegalSection titulo="5. Transferência internacional">
        <p>
          Alguns operadores acima processam dados fora do Brasil. Nesses casos, a
          transferência ocorre com base nas hipóteses do art. 33 da LGPD, adotando
          salvaguardas contratuais adequadas para garantir a proteção dos dados.
        </p>
      </LegalSection>

      <LegalSection titulo="6. Retenção e eliminação">
        <p>
          Mantemos os dados pelo tempo necessário às finalidades descritas e às
          obrigações legais/fiscais aplicáveis (art. 16 da LGPD). Pré-cadastros de
          orçamento do portal público não convertidos são anonimizados após{" "}
          <strong className="text-porcelain-ink">180 dias</strong>.
          Após o encerramento da conta, os dados são eliminados ou anonimizados,
          ressalvados os que a lei exige preservar.
        </p>
      </LegalSection>

      <LegalSection titulo="7. Seus direitos como titular">
        <p>
          Nos termos do art. 18 da LGPD, você pode solicitar: confirmação e acesso,
          correção, anonimização, portabilidade, eliminação, informação sobre
          compartilhamento e revogação de consentimento.
        </p>
        <p>
          Titulares com conta podem <strong className="text-porcelain-ink">exportar
          seus dados</strong> e <strong className="text-porcelain-ink">solicitar a
          exclusão</strong> diretamente em{" "}
          <em>Configurações → Segurança → Privacidade e seus dados</em>. Você também
          pode exercer seus direitos pelo e-mail do Encarregado (item 10).
        </p>
      </LegalSection>

      <LegalSection titulo="8. Segurança da informação">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger os dados, como
          criptografia em trânsito (HTTPS), armazenamento de senhas apenas como hash,
          verificação em duas etapas, isolamento entre estúdios, controle de acesso e
          registros de auditoria.
        </p>
      </LegalSection>

      <LegalSection titulo="9. Cookies">
        <p>
          Utilizamos cookies estritamente necessários para autenticação e segurança
          da sessão. Não utilizamos cookies de publicidade de terceiros.
        </p>
      </LegalSection>

      <LegalSection titulo="10. Encarregado (DPO) e contato">
        <p>
          Encarregado pelo Tratamento de Dados Pessoais:{" "}
          <strong className="text-porcelain-ink">Vinicius Vieira de Sousa</strong>. Para
          exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato
          pelo e-mail{" "}
          <strong className="text-porcelain-ink">vinicius@vstack-solutions.com.br</strong>{" "}
          ou pelo telefone{" "}
          <strong className="text-porcelain-ink">(11) 97335-8775</strong>.
        </p>
      </LegalSection>

      <LegalSection titulo="11. Alterações desta Política">
        <p>
          Podemos atualizar esta Política periodicamente. A versão vigente estará
          sempre disponível nesta página, com a data de vigência atualizada.
        </p>
      </LegalSection>

      <p className="pt-4 text-xs">
        Consulte também os nossos{" "}
        <Link href="/termos-de-uso" className="text-teal-ink hover:underline">
          Termos de Uso
        </Link>
        .
      </p>
    </LegalDocument>
  );
}
