/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          night: "var(--ink-night)",
        },
        deep: {
          graphite: "var(--deep-graphite)",
          teal: "var(--deep-teal)",
        },
        porcelain: {
          ink: "var(--porcelain-ink)",
        },
        teal: {
          ink: "var(--teal-ink)",
        },
        copper: {
          needle: "var(--copper-needle)",
        },
        smoke: {
          text: "var(--smoke-text)",
        },
        mist: {
          line: "var(--mist-line)",
        },
        error: {
          red: "var(--error-red)",
        },
        surface: {
          raised: "var(--surface-raised)",
          soft: "var(--surface-soft)",
        },
        text: {
          subtle: "var(--text-subtle)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
    },
  },
  plugins: [],
}
