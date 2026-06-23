import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat config do ESLint 9 (substitui o legado .eslintrc.json).
 *
 * eslint-config-next@16 já exporta arrays flat (Linter.Config[]) nos
 * subpaths, então basta espalhá-los — sem FlatCompat. Equivale ao antigo
 * extends ["next/core-web-vitals", "next/typescript"].
 */

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,

  // Arquivos de config CJS (next.config.js etc.) usam require/module.exports
  // legitimamente — não é dívida, é o formato do arquivo.
  {
    files: ["**/*.config.{js,cjs}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Dívida técnica PRÉ-EXISTENTE rebaixada de "error" para "warning":
  // não bloqueia build/check, mas fica visível para limpeza incremental.
  // (~48 `any`, regras do React Compiler, <a> interno vs <Link>, etc.)
  // O Next ignora lint no build (`eslint.ignoreDuringBuilds`), então isto
  // afeta só o `npm run lint`/`check`. Ao limpar cada item, promova de volta
  // para "error".
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
