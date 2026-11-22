import { describe, expect, it } from "vitest";

import {
  acoesDoDia,
  contagemRegressiva,
  linkWhatsApp,
  primeiroNome,
  proximaSessao,
  saudacao,
  sessoesDoDia,
  type AtendimentoHoje,
} from "./acoes-do-dia";

// 21/11/2026, 14:00 (horário local do ambiente: as funções comparam dia local).
const AGORA = new Date(2026, 10, 21, 14, 0, 0);

function iso(dia: number, hora: number, min = 0): string {
  return new Date(2026, 10, dia, hora, min, 0).toISOString();
}

function atend(
  parcial: Partial<AtendimentoHoje> & { id: string },
): AtendimentoHoje {
  return {
    tipo: "TATUAGEM",
    estilo: null,
    parte_corpo: null,
    tamanho_cm: null,
    status_operacional: "CONFIRMADO",
    status_financeiro: "PENDENTE",
    valor_total: null,
    valor_sinal: null,
    data_sessao: null,
    cliente: { id: "c1", nome: "Camila Rocha", telefone: "(11) 99999-0000" },
    ...parcial,
  };
}

describe("sessoesDoDia", () => {
  it("devolve só as sessões de hoje, sem canceladas, em ordem de horário", () => {
    const lista = [
      atend({ id: "tarde", data_sessao: iso(21, 16) }),
      atend({
        id: "manha",
        data_sessao: iso(21, 9),
        status_operacional: "FINALIZADO",
      }),
      atend({
        id: "cancelada",
        data_sessao: iso(21, 11),
        status_operacional: "CANCELADO_CLIENTE",
      }),
      atend({ id: "amanha", data_sessao: iso(22, 10) }),
      atend({ id: "sem-data" }),
    ];
    expect(sessoesDoDia(lista, AGORA).map((a) => a.id)).toEqual([
      "manha",
      "tarde",
    ]);
  });
});

describe("proximaSessao", () => {
  it("prioriza a sessão em andamento", () => {
    const lista = [
      atend({ id: "futura", data_sessao: iso(21, 18) }),
      atend({
        id: "agora",
        data_sessao: iso(21, 13),
        status_operacional: "EM_ATENDIMENTO",
      }),
    ];
    expect(proximaSessao(lista, AGORA)?.id).toBe("agora");
  });

  it("ignora passadas, concluídas e canceladas e pega a mais próxima", () => {
    const lista = [
      atend({ id: "passada", data_sessao: iso(21, 9) }),
      atend({
        id: "concluida",
        data_sessao: iso(21, 15),
        status_operacional: "FINALIZADO",
      }),
      atend({
        id: "cancelada",
        data_sessao: iso(21, 15),
        status_operacional: "CANCELADO_ESTUDIO",
      }),
      atend({ id: "depois", data_sessao: iso(23, 10) }),
      atend({ id: "proxima", data_sessao: iso(21, 17) }),
    ];
    expect(proximaSessao(lista, AGORA)?.id).toBe("proxima");
  });

  it("devolve null quando não há nada pela frente", () => {
    expect(proximaSessao([atend({ id: "x" })], AGORA)).toBeNull();
  });
});

describe("acoesDoDia", () => {
  it("transforma status em ações: confirmar sinal, cobrar sinal e responder", () => {
    const lista = [
      atend({ id: "a", status_operacional: "SOLICITADO" }),
      atend({ id: "b", status_operacional: "EM_ANALISE" }),
      atend({
        id: "c",
        status_operacional: "AGUARDANDO_SINAL",
        valor_sinal: 200,
      }),
      atend({
        id: "d",
        status_operacional: "AGUARDANDO_SINAL",
        status_financeiro: "SINAL_PAGO",
        valor_sinal: 250,
      }),
      atend({ id: "e", status_operacional: "CONFIRMADO" }),
      atend({ id: "f", status_operacional: "FINALIZADO" }),
    ];
    const acoes = acoesDoDia(lista, AGORA);
    expect(acoes.map((a) => [a.atendimentoId, a.tipo])).toEqual([
      ["d", "confirmar_sinal"],
      ["c", "cobrar_sinal"],
      ["a", "responder"],
      ["b", "responder"],
    ]);
    expect(acoes.find((a) => a.atendimentoId === "c")?.valor).toBe(200);
    expect(acoes.find((a) => a.atendimentoId === "a")?.valor).toBeNull();
  });

  it("coloca sessões das próximas 48 h na frente, mesmo com prioridade menor", () => {
    const lista = [
      atend({
        id: "longe",
        status_operacional: "AGUARDANDO_SINAL",
        data_sessao: iso(30, 10),
      }),
      atend({
        id: "perto",
        status_operacional: "SOLICITADO",
        data_sessao: iso(22, 10),
      }),
    ];
    const acoes = acoesDoDia(lista, AGORA);
    expect(acoes[0]?.atendimentoId).toBe("perto");
    expect(acoes[0]?.urgente).toBe(true);
    expect(acoes[1]?.urgente).toBe(false);
  });

  it("não quebra sem cliente vinculado", () => {
    const [acao] = acoesDoDia(
      [atend({ id: "z", status_operacional: "SOLICITADO", cliente: null })],
      AGORA,
    );
    expect(acao?.clienteNome).toBe("Cliente sem cadastro");
    expect(acao?.telefone).toBeNull();
  });
});

describe("linkWhatsApp", () => {
  it("monta o link com DDI 55 e mensagem codificada", () => {
    expect(linkWhatsApp("(11) 99999-0000", "Oi, tudo bem?")).toBe(
      "https://wa.me/5511999990000?text=Oi%2C%20tudo%20bem%3F",
    );
  });
  it("mantém número que já tem DDI", () => {
    expect(linkWhatsApp("+55 11 99999-0000", "x")).toContain(
      "wa.me/5511999990000",
    );
  });
  it("devolve null sem telefone utilizável", () => {
    expect(linkWhatsApp(null, "x")).toBeNull();
    expect(linkWhatsApp("123", "x")).toBeNull();
  });
});

describe("contagemRegressiva", () => {
  it("formata minutos, horas e dias", () => {
    expect(contagemRegressiva(new Date(2026, 10, 21, 14, 42), AGORA)).toBe(
      "42 min",
    );
    expect(contagemRegressiva(new Date(2026, 10, 21, 16, 10), AGORA)).toBe(
      "2 h 10 min",
    );
    expect(contagemRegressiva(new Date(2026, 10, 21, 17, 0), AGORA)).toBe(
      "3 h",
    );
    expect(contagemRegressiva(new Date(2026, 10, 24, 14, 0), AGORA)).toBe(
      "3 dias",
    );
    expect(contagemRegressiva(new Date(2026, 10, 22, 14, 0), AGORA)).toBe(
      "1 dia",
    );
  });
  it("devolve 'agora' para passado ou menos de 1 min", () => {
    expect(contagemRegressiva(new Date(2026, 10, 21, 13, 0), AGORA)).toBe(
      "agora",
    );
  });
});

describe("saudacao e primeiroNome", () => {
  it("varia por período do dia", () => {
    expect(saudacao(new Date(2026, 10, 21, 8))).toBe("Bom dia");
    expect(saudacao(new Date(2026, 10, 21, 14))).toBe("Boa tarde");
    expect(saudacao(new Date(2026, 10, 21, 20))).toBe("Boa noite");
  });
  it("extrai o primeiro nome", () => {
    expect(primeiroNome("Lia Monteiro")).toBe("Lia");
    expect(primeiroNome(undefined)).toBe("");
  });
});
