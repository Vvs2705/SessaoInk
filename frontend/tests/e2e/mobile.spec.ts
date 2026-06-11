import { test, expect, Page } from "@playwright/test";

/**
 * Regressão de responsividade mobile do dashboard.
 *
 * Roda em todos os projetos da config (incl. iphone-15, pixel-7, mobile-360/
 * 390/412). Os asserts de "mobile only" são pulados em viewport >= 1024px
 * (lg do Tailwind, onde a sidebar substitui a bottom nav).
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "admin@sessaoink.dev");
  await page.fill("#senha", "admin123");
  await page.click("button[type='submit']");
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });
  // Espera o dashboard sair do skeleton (h1 real visível).
  await expect(page.locator("h1:has-text('Painel Inicial')")).toBeVisible({
    timeout: 10000,
  });
}

function isMobile(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width < 1024;
}

test.describe("Dashboard — responsividade", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("não gera scroll horizontal (sem overflow lateral)", async ({ page }) => {
    // Tolerância de 1px para arredondamento sub-pixel.
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("nenhum elemento ultrapassa a largura da viewport", async ({ page }) => {
    const vw = page.viewportSize()!.width;
    const piores = await page.evaluate(() => {
      const out: { tag: string; cls: string; right: number }[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 1) {
          out.push({
            tag: el.tagName,
            cls: (el.getAttribute("class") || "").slice(0, 60),
            right: Math.round(r.right),
          });
        }
      });
      return out.slice(0, 8);
    });
    expect(
      piores,
      `Elementos estourando ${vw}px: ${JSON.stringify(piores, null, 2)}`,
    ).toEqual([]);
  });

  test("bottom nav visível no mobile, oculta no desktop", async ({ page }) => {
    const nav = page.locator("nav[aria-label='Navegação principal mobile']");
    if (isMobile(page)) {
      await expect(nav).toBeVisible();
      // Fixa na base da viewport.
      const box = await nav.boundingBox();
      const vp = page.viewportSize()!;
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeGreaterThanOrEqual(vp.height - 4);
    } else {
      await expect(nav).toBeHidden();
    }
  });

  test("dashboard usa escala 1 (sem exigir zoom)", async ({ page }) => {
    // initial-scale=1 → visualViewport.scale === 1 ao carregar.
    const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    expect(scale).toBeCloseTo(1, 1);
  });

  test("botão 'Como usar' não cobre a bottom nav no mobile", async ({ page }) => {
    if (!isMobile(page)) test.skip();
    const guide = page.getByRole("button", { name: /Ajuda da página/i });
    const nav = page.locator("nav[aria-label='Navegação principal mobile']");
    const gb = await guide.boundingBox();
    const nb = await nav.boundingBox();
    expect(gb).not.toBeNull();
    expect(nb).not.toBeNull();
    // A base do botão fica acima do topo da nav.
    expect(gb!.y + gb!.height).toBeLessThanOrEqual(nb!.y + 1);
  });
});
