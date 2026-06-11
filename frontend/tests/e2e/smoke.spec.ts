import { test, expect } from "@playwright/test";

test.describe("SessãoInk E2E Smoke Tests", () => {
  test.beforeEach(({ page }) => {
    page.on("console", msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    page.on("pageerror", err => {
      console.log(`[BROWSER EXCEPTION] ${err.stack}`);
    });
  });

  test("deve redirecionar visitantes não autenticados para /login", async ({ page }) => {
    await page.goto("/clientes");
    await page.waitForURL(/.*\/login/);
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("deve fazer login com sucesso e ir para o dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@sessaoink.dev");
    await page.fill("#senha", "admin123");
    await page.click("button[type='submit']");
    await page.waitForURL("http://localhost:3000/", { timeout: 8000 });
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("deve preencher e enviar o formulário de orçamento público com sucesso", async ({ page }) => {
    await page.goto("/demo/orcamento");
    await expect(page.locator("h1:has-text('Solicitar Orçamento')")).toBeVisible();

    // PASSO 1
    await page.fill("input[placeholder='Seu nome completo']", "Cliente E2E Teste");
    await page.fill("input[placeholder='(11) 99999-9999']", "11999999999");
    await page.click("button:has-text('Avançar')");

    // PASSO 2
    await page.fill("textarea", "Ideia de tatuagem realista de leão no braço.");
    await page.selectOption("select", "Realismo");
    await page.fill("input[placeholder='Ex: braço']", "Antebraço");
    await page.fill("input[placeholder='Ex: 15cm']", "15cm");
    await page.click("button:has-text('Avançar')");

    // PASSO 3 (Opcional - carregar imagem)
    await page.click("button:has-text('Avançar')");

    // PASSO 4 (Opcional - "Quando você pode?" / datas de preferência)
    await page.click("button:has-text('Avançar')");

    // PASSO 5 (Termos de privacidade)
    // Clica nos dois checkboxes
    const checkboxes = page.locator("input[type='checkbox']");
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    // Enviar
    await page.click("button:has-text('Enviar Pedido')");

    // Tela de sucesso
    await expect(page.locator("text=Orçamento enviado!")).toBeVisible();
    await expect(page.locator("text=Protocolo")).toBeVisible();
  });
});
