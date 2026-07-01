import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, LegalSection } from "@/components/legal/LegalDocument";

export const metadata: Metadata = {
  title: "Termos de Uso — SessãoInk",
  description:
    "Condições de uso da plataforma SessãoInk para gestão de estúdios de tatuagem.",
};

export default function TermosDeUsoPage() {
  return (
    <LegalDocument
      titulo="Termos de Uso"
      vigencia="1º de julho de 2026"
      versao="2026-07-01"
    >
      <p>
        Estes Termos de Uso regem o acesso e a utilização da plataforma SessãoInk,
        oferecida por{" "}
        <strong className="text-porcelain-ink">
          [RAZÃO SOCIAL], CNPJ nº [CNPJ]
        </strong>{" "}
        (&ldquo;SessãoInk&rdquo;). Ao criar uma conta ou utilizar a plataforma, você
        declara ter lido e concordado com estes Termos.
      </p>

      <LegalSection titulo="1. Objeto">
        <p>
          A SessãoInk é uma plataforma de software como serviço (SaaS) para gestão de
          estúdios de tatuagem — agenda, atendimentos, clientes, portfólio, documentos
          e cobrança. A SessãoInk não presta serviços de tatuagem nem intermedia a
          relação entre estúdios e seus clientes.
        </p>
      </LegalSection>

      <LegalSection titulo="2. Cadastro e conta">
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Você é responsável pela veracidade das informações fornecidas e pela
            guarda das suas credenciais.
          </li>
          <li>
            Contas de administrador devem manter a verificação em duas etapas ativa,
            por segurança.
          </li>
          <li>
            Você deve ter capacidade legal para contratar. É vedado o uso por menores
            de 18 anos sem representação legal.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="3. Planos, cobrança e cancelamento">
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Os planos, ciclos e valores vigentes são apresentados na plataforma. A
            cobrança é processada pelo Mercado Pago.
          </li>
          <li>
            Assinaturas recorrentes são renovadas automaticamente ao fim de cada ciclo
            até o cancelamento.
          </li>
          <li>
            Você pode cancelar a qualquer momento; o acesso permanece ativo até o fim
            do período já pago, salvo disposição legal diversa.
          </li>
          <li>
            Eventuais reembolsos observam a legislação consumerista aplicável.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="4. Responsabilidades do usuário (estúdio)">
        <p>
          Ao inserir dados de seus clientes, o estúdio atua como{" "}
          <strong className="text-porcelain-ink">controlador</strong> desses dados e
          se compromete a:
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Obter as bases legais adequadas (inclusive consentimento, quando exigido)
            para tratar os dados de seus clientes.
          </li>
          <li>
            Utilizar a plataforma em conformidade com a LGPD e demais leis aplicáveis.
          </li>
          <li>
            Não inserir conteúdo ilícito, ofensivo ou que viole direitos de terceiros.
          </li>
        </ul>
      </LegalSection>

      <LegalSection titulo="5. Papel da SessãoInk como operadora">
        <p>
          Em relação aos dados dos clientes do estúdio, a SessãoInk atua como
          operadora, tratando-os conforme as instruções do estúdio e a nossa{" "}
          <Link href="/politica-de-privacidade" className="text-teal-ink hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection titulo="6. Propriedade intelectual">
        <p>
          A plataforma, sua marca, código e elementos visuais são de titularidade da
          SessãoInk. O conteúdo que você insere (imagens, textos, dados) permanece seu;
          você nos concede licença limitada para hospedá-lo e exibi-lo conforme
          necessário à prestação do serviço.
        </p>
      </LegalSection>

      <LegalSection titulo="7. Disponibilidade e limitação de responsabilidade">
        <p>
          Empregamos esforços para manter a plataforma disponível e segura, mas o
          serviço é fornecido &ldquo;no estado em que se encontra&rdquo;. Na máxima
          extensão permitida pela lei, a SessãoInk não se responsabiliza por danos
          indiretos, lucros cessantes ou perdas decorrentes de indisponibilidade,
          mau uso ou de atos praticados pelo estúdio perante seus clientes.
        </p>
      </LegalSection>

      <LegalSection titulo="8. Suspensão e rescisão">
        <p>
          Podemos suspender ou encerrar contas que violem estes Termos ou a lei. Você
          pode encerrar sua conta a qualquer momento. Após o encerramento, os dados são
          tratados conforme a Política de Privacidade.
        </p>
      </LegalSection>

      <LegalSection titulo="9. Alterações dos Termos">
        <p>
          Podemos atualizar estes Termos. A versão vigente estará sempre disponível
          nesta página; alterações relevantes poderão ser comunicadas pelos canais da
          plataforma.
        </p>
      </LegalSection>

      <LegalSection titulo="10. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica
          eleito o foro da comarca de{" "}
          <strong className="text-porcelain-ink">[CIDADE/UF]</strong> para dirimir
          controvérsias, salvo competência legal diversa.
        </p>
      </LegalSection>

      <LegalSection titulo="11. Contato">
        <p>
          Dúvidas sobre estes Termos:{" "}
          <strong className="text-porcelain-ink">[E-MAIL DE CONTATO]</strong>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
