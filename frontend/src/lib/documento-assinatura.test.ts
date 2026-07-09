import { describe, expect, it } from "vitest";

import { buildAssinarFormBody, mensagemErroToken } from "./documento-assinatura";

describe("buildAssinarFormBody", () => {
  it("monta form urlencoded com nome_assinante (campo exato do backend)", () => {
    const body = buildAssinarFormBody("João da Silva");
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("nome_assinante")).toBe("João da Silva");
    expect(Array.from(body.keys())).toEqual(["nome_assinante"]);
  });

  it("remove espaços das pontas do nome", () => {
    expect(buildAssinarFormBody("  Maria  ").get("nome_assinante")).toBe("Maria");
  });
});

describe("mensagemErroToken", () => {
  it("404 vira mensagem amigável de link inválido/expirado/usado", () => {
    expect(mensagemErroToken(404, "Link inválido, expirado ou já utilizado")).toMatch(
      /inválido, expirou ou já foi utilizado/
    );
  });

  it("usa o detail do backend quando não é 404", () => {
    expect(mensagemErroToken(400, "Documento já está assinado")).toBe(
      "Documento já está assinado"
    );
  });

  it("tem fallback genérico sem detail", () => {
    expect(mensagemErroToken(500)).toMatch(/Tente novamente/);
  });
});
