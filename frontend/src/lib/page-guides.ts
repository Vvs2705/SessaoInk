/**
 * Registro de guias por página (Fase Roadmap — clareza de uso / onboarding).
 *
 * Cada guia explica, em português claro: o que a página FAZ, COMO usar
 * (passo a passo) e PARA QUE serve. Usado pelo componente <PageGuide/>, que
 * resolve o guia pela rota atual. Conteúdo real — sem placeholders.
 */

export interface PageGuide {
  titulo: string;
  oQueFaz: string;
  comoUsar: string[];
  paraQueServe: string;
  dicas?: string[];
}

/**
 * Chave = prefixo de rota. A resolução escolhe a chave EXATA, senão a mais
 * específica (mais longa) que casa com o início do pathname.
 */
export const PAGE_GUIDES: Record<string, PageGuide> = {
  "/": {
    titulo: "Início (Painel)",
    oQueFaz:
      "Mostra um resumo do seu estúdio: próximos atendimentos, indicadores do período e atalhos para as áreas mais usadas.",
    comoUsar: [
      "Confira os cards de resumo no topo para ter a visão geral do dia.",
      "Use os atalhos para ir direto a Agenda, Clientes ou Financeiro.",
      "Acompanhe os próximos atendimentos para se organizar.",
    ],
    paraQueServe:
      "Ter, em segundos, a fotografia do estúdio e decidir o que fazer a seguir.",
  },
  "/agenda": {
    titulo: "Agenda",
    oQueFaz:
      "Organiza os agendamentos do estúdio em calendário, com horários, artistas e status de cada sessão.",
    comoUsar: [
      "Navegue entre os dias/semanas para ver a ocupação.",
      "Crie um novo agendamento informando cliente, data/horário e artista.",
      "Reagende ou cancele abrindo o agendamento; o sistema valida conflitos de horário.",
    ],
    paraQueServe:
      "Evitar choques de horário e manter artistas e clientes sincronizados.",
    dicas: ["Agendamentos confirmados podem virar atendimentos automaticamente."],
  },
  "/atendimentos": {
    titulo: "Atendimentos",
    oQueFaz:
      "Lista todos os atendimentos (orçamentos, sessões e finalizações) com status operacional e financeiro.",
    comoUsar: [
      "Filtre por status para focar no que precisa de ação.",
      "Abra um atendimento para ver detalhes, evolução e documentos vinculados.",
      "Atualize o status conforme o fluxo (solicitado → confirmado → finalizado).",
    ],
    paraQueServe:
      "Acompanhar cada trabalho do começo ao fim, sem perder etapa.",
  },
  "/atendimentos/": {
    titulo: "Detalhe do Atendimento",
    oQueFaz:
      "Mostra tudo de um atendimento específico: cliente, evolução, valores, imagens de referência e documentos.",
    comoUsar: [
      "Atualize o status operacional e financeiro conforme avança.",
      "Vincule documentos (termo/consentimento) e gere link de assinatura.",
      "Registre valores e forma de pagamento quando aplicável.",
    ],
    paraQueServe:
      "Centralizar o histórico de um trabalho e manter o registro completo para o cliente.",
  },
  "/clientes": {
    titulo: "Clientes",
    oQueFaz:
      "Cadastro central dos seus clientes, com contato e histórico de atendimentos.",
    comoUsar: [
      "Cadastre um cliente com nome e WhatsApp.",
      "Use a busca para localizar rapidamente.",
      "Abra um cliente para ver seu histórico e dados.",
    ],
    paraQueServe:
      "Ter a base de clientes organizada para atendimento e relacionamento.",
  },
  "/clientes/": {
    titulo: "Detalhe do Cliente",
    oQueFaz:
      "Reúne os dados de um cliente e o histórico de atendimentos dele.",
    comoUsar: [
      "Edite os dados de contato quando necessário.",
      "Veja o histórico de sessões e documentos do cliente.",
    ],
    paraQueServe:
      "Conhecer o cliente e dar um atendimento personalizado.",
  },
  "/portfolio": {
    titulo: "Portfólio",
    oQueFaz:
      "Galeria dos seus trabalhos. Você controla quais ficam privados e quais aparecem no portal público.",
    comoUsar: [
      "Faça upload das fotos (JPG/PNG/WEBP). Os metadados/EXIF são removidos automaticamente.",
      "Marque a autorização de publicação quando o cliente permitir.",
      "Defina a visibilidade (privado/público) de cada item.",
    ],
    paraQueServe:
      "Mostrar seu trabalho com segurança e atrair novos clientes pelo portal.",
    dicas: ["Só itens autorizados E públicos aparecem no portal do estúdio."],
  },
  "/flash-arts": {
    titulo: "Flash Arts",
    oQueFaz:
      "Catálogo de desenhos prontos (flash) com preço, tamanho e local sugerido.",
    comoUsar: [
      "Cadastre a arte com imagem, título e preço.",
      "Marque como disponível para aparecer no portal público.",
      "Atualize o status quando uma flash for tatuada.",
    ],
    paraQueServe:
      "Vender desenhos prontos e facilitar a escolha do cliente.",
  },
  "/financeiro": {
    titulo: "Financeiro",
    oQueFaz:
      "Controla entradas, saídas, sinais e comissões do estúdio.",
    comoUsar: [
      "Registre lançamentos (entrada/saída/sinal) com valor e descrição.",
      "Marque como pago e acompanhe o status.",
      "Use os filtros para conferir o período.",
    ],
    paraQueServe:
      "Saber quanto entra e sai, e manter a saúde financeira do estúdio.",
    dicas: ["Criar/editar/excluir lançamentos é restrito ao ADMIN."],
  },
  "/estoque": {
    titulo: "Estoque",
    oQueFaz:
      "Controla insumos do estúdio (agulhas, tintas, descartáveis) e suas quantidades.",
    comoUsar: [
      "Cadastre os itens com quantidade atual.",
      "Atualize as quantidades conforme usa ou repõe.",
      "Acompanhe itens com baixo estoque.",
    ],
    paraQueServe:
      "Evitar ficar sem material no meio de um atendimento.",
  },
  "/documentos": {
    titulo: "Documentos",
    oQueFaz:
      "Gera e gerencia termos e consentimentos, com link seguro de assinatura para o cliente.",
    comoUsar: [
      "Crie o documento vinculado ao cliente/atendimento.",
      "Gere o link seguro (expira e é de uso único) e envie ao cliente.",
      "Acompanhe a assinatura — IP, data e nome ficam registrados (auditoria).",
    ],
    paraQueServe:
      "Ter respaldo jurídico com consentimento assinado e rastreável.",
    dicas: ["O link mostra só a URL final; o token nunca é exposto separadamente."],
  },
  "/relatorios": {
    titulo: "Relatórios",
    oQueFaz:
      "Mostra métricas do estúdio: receita por período, ticket médio, atendimentos por status e evolução no tempo.",
    comoUsar: [
      "Escolha o período de análise.",
      "Compare a receita com o período anterior.",
      "Use os gráficos para identificar tendências.",
    ],
    paraQueServe:
      "Tomar decisões com base em dados reais do negócio.",
    dicas: ["Relatórios são restritos ao ADMIN."],
  },
  "/configuracoes": {
    titulo: "Configurações",
    oQueFaz:
      "Define os dados do estúdio (nome, bio, cidade, redes) que aparecem no portal público, e ajustes da conta.",
    comoUsar: [
      "Atualize as informações do estúdio.",
      "Confira o slug do portal público.",
      "Altere sua senha quando necessário (revoga as demais sessões).",
    ],
    paraQueServe:
      "Manter a identidade do estúdio e a segurança da conta em dia.",
    dicas: ["Alterar a configuração do estúdio é restrito ao ADMIN."],
  },
  "/mais": {
    titulo: "Mais",
    oQueFaz:
      "Reúne acessos secundários e ações da conta, incluindo sair com segurança.",
    comoUsar: [
      "Acesse áreas e ações que não estão na navegação principal.",
      "Use 'Sair' para encerrar a sessão com segurança.",
    ],
    paraQueServe:
      "Centralizar ações de conta e atalhos extras.",
  },
};

/** Resolve o guia da rota atual: chave exata > prefixo mais específico > Início. */
export function resolveGuide(pathname: string): PageGuide | null {
  if (PAGE_GUIDES[pathname]) return PAGE_GUIDES[pathname];

  // Detalhe (ex.: /atendimentos/123) casa com a chave "/atendimentos/"
  let melhor: { chave: string; guia: PageGuide } | null = null;
  for (const [chave, guia] of Object.entries(PAGE_GUIDES)) {
    if (chave === "/") continue;
    if (pathname.startsWith(chave)) {
      if (!melhor || chave.length > melhor.chave.length) {
        melhor = { chave, guia };
      }
    }
  }
  if (melhor) return melhor.guia;
  return pathname === "/" ? PAGE_GUIDES["/"] : null;
}
