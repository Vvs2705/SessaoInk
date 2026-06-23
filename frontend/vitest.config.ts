import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Config dos testes UNITÁRIOS (vitest).
 *
 * Os testes e2e ficam em `tests/e2e/*.spec.ts` e rodam pelo Playwright
 * (`npm run test:e2e`). Sem este `include`, o vitest usaria o padrão
 * `**\/*.{test,spec}.*` e tentaria coletar esses specs do Playwright
 * (que usam `test(({ page }) => ...)`), quebrando `npm run test` e,
 * por consequência, `npm run check`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**", ".next/**"],
  },
  resolve: {
    // Espelha o alias do tsconfig: "@/*" -> "./src/*"
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
});
