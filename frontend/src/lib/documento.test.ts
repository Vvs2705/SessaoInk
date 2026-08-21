import { describe, expect, it } from "vitest";

import { isDocumentoValido, maskDocumento, unmaskDocumento } from "@/lib/documento";

describe("maskDocumento", () => {
  it("mascara progressivamente como CPF até 11 dígitos", () => {
    expect(maskDocumento("111")).toBe("111");
    expect(maskDocumento("1114")).toBe("111.4");
    expect(maskDocumento("11144477735")).toBe("111.444.777-35");
  });

  it("vira CNPJ a partir do 12º caractere", () => {
    expect(maskDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskDocumento("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });

  it("ignora o excedente de 14 caracteres e a máscara já digitada", () => {
    expect(maskDocumento("11.222.333/0001-8199")).toBe("11.222.333/0001-81");
  });
});

describe("unmaskDocumento", () => {
  it("deixa só alfanuméricos em maiúsculas", () => {
    expect(unmaskDocumento("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });
});

describe("isDocumentoValido", () => {
  it("aceita CPF, CNPJ numérico e CNPJ alfanumérico válidos", () => {
    expect(isDocumentoValido("111.444.777-35")).toBe(true);
    expect(isDocumentoValido("11.222.333/0001-81")).toBe(true);
    expect(isDocumentoValido("12.ABC.345/01DE-35")).toBe(true);
  });

  it("rejeita DV errado, sequência repetida e comprimento inválido", () => {
    expect(isDocumentoValido("111.444.777-36")).toBe(false);
    expect(isDocumentoValido("11111111111")).toBe(false);
    expect(isDocumentoValido("11111111111111")).toBe(false);
    expect(isDocumentoValido("1114447773")).toBe(false);
    expect(isDocumentoValido("")).toBe(false);
    // DV nunca é letra
    expect(isDocumentoValido("12ABC34501DEX5")).toBe(false);
  });
});
