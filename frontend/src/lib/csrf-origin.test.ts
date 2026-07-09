import { describe, expect, it } from "vitest";

import { originPermitido } from "./csrf-origin";

const APP = "https://www.sessaoink.com.br";

describe("originPermitido (CSRF por origin no proxy)", () => {
  it("permite same-origin (Origin ausente)", () => {
    expect(originPermitido(null, APP, "https://www.sessaoink.com.br")).toBe(true);
  });

  it("permite quando Origin === domínio canônico", () => {
    expect(originPermitido(APP, APP, "https://outro.host")).toBe(true);
  });

  it("permite quando Origin === host que serve a rota (qualquer domínio próprio)", () => {
    // usuário no domínio antigo .vercel.app: APP_ORIGIN é o novo, mas selfOrigin bate
    expect(
      originPermitido(
        "https://sessao-ink.vercel.app",
        APP,
        "https://sessao-ink.vercel.app",
      ),
    ).toBe(true);
  });

  it("BLOQUEIA cross-origin de terceiro (CSRF real)", () => {
    expect(
      originPermitido("https://evil.com", APP, "https://www.sessaoink.com.br"),
    ).toBe(false);
  });

  it("BLOQUEIA quando não há host confiável e Origin não é o canônico", () => {
    expect(originPermitido("https://evil.com", APP, null)).toBe(false);
  });
});
