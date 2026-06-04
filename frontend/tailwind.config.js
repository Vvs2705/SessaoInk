/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "-apple-system", "sans-serif"],
        display: ["Cormorant", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      colors: {
        ink: {
          night: "var(--ink-night)",
          gold: "var(--si-gold)",
          // Sistema de superfícies em camadas (design upgrade)
          bg: "var(--si-bg)",
          surface: "var(--si-surface)",
          raised: "var(--si-raised)",
          overlay: "var(--si-overlay)",
          teal: "var(--si-teal)",
          text: "var(--si-text)",
          muted: "var(--si-text-muted)",
          subtle: "var(--si-text-subtle)",
          border: "var(--si-border)",
          "border-strong": "var(--si-border-strong)",
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
        gold: "0 0 0 1px var(--si-gold-border), 0 4px 20px rgba(201,169,110,0.18)",
        "gold-sm": "0 0 0 1px var(--si-gold-border)",
        ink: "0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px var(--si-border)",
        "ink-md": "0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px var(--si-border)",
        "ink-lg": "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--si-border)",
      },
      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(5px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(201,169,110,0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(201,169,110,0.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
        "slide-up": "slide-up 0.35s ease-out both",
        "slide-in-right": "slide-in-right 0.3s ease-out both",
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
}
