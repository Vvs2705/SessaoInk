import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "line",
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
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      env: {
        NEXT_PUBLIC_API_URL: "http://localhost:8001",
      },
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "cd ../backend && python -m uvicorn app.main:app --port 8001",
      url: "http://localhost:8001/health",
      env: {
        DATABASE_URL: "sqlite+aiosqlite:///./dev.db",
      },
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
