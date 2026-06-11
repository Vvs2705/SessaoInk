import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
  // Generoso: o dev server do Next compila cada rota no 1º acesso (login +
  // proxy + dashboard), o que sozinho pode passar dos 30s padrão. Build de
  // produção é instantâneo — isto é só para o `npm run dev` do E2E local.
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Dispositivos mobile reais (DPR/UA corretos) — pegam bugs que viewport
    // puro não pega (ex.: barra de endereço, safe-area, touch).
    {
      name: "iphone-15",
      use: { ...devices["iPhone 15"] },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
    // Viewports-alvo do projeto — small/medium/large phone.
    {
      name: "mobile-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-412",
      use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      env: {
        // Modo proxy (production-like): sem NEXT_PUBLIC_API_URL, o client usa
        // rotas relativas /api/v1 que o Next encaminha para BACKEND_URL. Assim
        // os cookies de sessão vivem no domínio :3000 (visíveis ao middleware) —
        // exatamente como em produção. Modo direto deixaria o cookie em :8001 e
        // o middleware do :3000 expulsaria o usuário de volta ao /login.
        BACKEND_URL: "http://localhost:8001",
      },
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "cd ../backend && python -m uvicorn app.main:app --port 8001",
      url: "http://localhost:8001/health",
      env: {
        DATABASE_URL: "sqlite+aiosqlite:///./dev.db",
        // Vars exigidas pelo config do backend. ENVIRONMENT=development ativa o
        // fallback gracioso para MockRedis (não precisa de Redis rodando) e
        // desliga os guardrails de produção (CSRF strict, cookie Secure).
        SECRET_KEY: "dev-e2e-secret-key-min-32-characters-long",
        REDIS_URL: "redis://localhost:6379",
        ENVIRONMENT: "development",
      },
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
