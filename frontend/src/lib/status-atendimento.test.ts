import { describe, expect, it } from "vitest";

import {
  GRUPOS_STATUS,
  ROTULO_STATUS_DETALHADO,
  grupoDoStatus,
} from "./status-atendimento";

describe("grupoDoStatus", () => {
  it("agrupa os 11 status do backend em 5 estados visuais", () => {
    expect(grupoDoStatus("SOLICITADO")).toBe("pendente");
    expect(grupoDoStatus("EM_ANALISE")).toBe("pendente");
    expect(grupoDoStatus("AGUARDANDO_SINAL")).toBe("pendente");
    expect(grupoDoStatus("REAGENDADO")).toBe("pendente");
    expect(grupoDoStatus("CONFIRMADO")).toBe("confirmado");
    expect(grupoDoStatus("RETOQUE")).toBe("confirmado");
    expect(grupoDoStatus("EM_ATENDIMENTO")).toBe("em_sessao");
    expect(grupoDoStatus("FINALIZADO")).toBe("concluido");
    expect(grupoDoStatus("CANCELADO_CLIENTE")).toBe("cancelado");
    expect(grupoDoStatus("CANCELADO_ESTUDIO")).toBe("cancelado");
    expect(grupoDoStatus("NAO_COMPARECEU")).toBe("cancelado");
  });

  it("trata status desconhecido como pendente (pede atenção)", () => {
    expect(grupoDoStatus("STATUS_NOVO")).toBe("pendente");
  });

  it("todo status conhecido tem rótulo detalhado e todo grupo tem config", () => {
    for (const status of Object.keys(ROTULO_STATUS_DETALHADO)) {
      expect(GRUPOS_STATUS[grupoDoStatus(status)].label).toBeTruthy();
    }
    expect(Object.keys(GRUPOS_STATUS)).toHaveLength(5);
  });
});
