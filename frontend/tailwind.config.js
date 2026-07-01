// Habilita modificador de opacidade do Tailwind (ex.: bg-teal-ink/20) em tokens
// definidos como cor cheia (var --token, com fallback hex + OKLCH). color-mix
// preserva o OKLCH; suporte ~95% (browsers 2023+). Sem isso, /opacidade em token
// não funcionaria e o refactor de hex ficaria incompleto.
const withAlpha = (v) => `color-mix(in oklab, ${v} calc(<alpha-value> * 100%), transparent)`;

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
        display: ["Fraunces", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      colors: {
        ink: {
          night: withAlpha("var(--ink-night)"),
          gold: withAlpha("var(--si-gold)"),
          // Sistema de superfícies em camadas (design upgrade)
          bg: withAlpha("var(--si-bg)"),
          surface: withAlpha("var(--si-surface)"),
          raised: withAlpha("var(--si-raised)"),
          overlay: withAlpha("var(--si-overlay)"),
          teal: withAlpha("var(--si-teal)"),
          text: withAlpha("var(--si-text)"),
          muted: withAlpha("var(--si-text-muted)"),
          subtle: withAlpha("var(--si-text-subtle)"),
          border: withAlpha("var(--si-border)"),
          "border-strong": withAlpha("var(--si-border-strong)"),
        },
        deep: {
          graphite: withAlpha("var(--deep-graphite)"),
          teal: withAlpha("var(--deep-teal)"),
        },
        porcelain: {
          ink: withAlpha("var(--porcelain-ink)"),
        },
        teal: {
          ink: withAlpha("var(--teal-ink)"),
        },
        copper: {
          needle: withAlpha("var(--copper-needle)"),
        },
        smoke: {
          text: withAlpha("var(--smoke-text)"),
        },
        mist: {
          line: withAlpha("var(--mist-line)"),
        },
        error: {
          red: withAlpha("var(--error-red)"),
        },
        surface: {
          raised: withAlpha("var(--surface-raised)"),
          soft: withAlpha("var(--surface-soft)"),
        },
        text: {
          subtle: withAlpha("var(--text-subtle)"),
        },
        // Acento de identidade (esmeralda) + acento quente (cobre)
        si: {
          accent: withAlpha("var(--si-accent)"),
          warm: withAlpha("var(--si-warm)"),
        },
        // Semânticos de estado
        warning: withAlpha("var(--warning)"),
        success: withAlpha("var(--success)"),
        info: withAlpha("var(--info)"),
        // Status de atendimento (antes só via CSS var / .status-badge)
        status: {
          solicitado: withAlpha("var(--status-solicitado)"),
          "aguardando-sinal": withAlpha("var(--status-aguardando-sinal)"),
          confirmado: withAlpha("var(--status-confirmado)"),
          finalizado: withAlpha("var(--status-finalizado)"),
          cancelado: withAlpha("var(--status-cancelado)"),
          "nao-compareceu": withAlpha("var(--status-nao-compareceu)"),
          privado: withAlpha("var(--status-privado)"),
          publico: withAlpha("var(--status-publico)"),
        },
        // Status financeiro
        fin: {
          pendente: withAlpha("var(--fin-pendente)"),
          "sinal-pago": withAlpha("var(--fin-sinal-pago)"),
          "pago-total": withAlpha("var(--fin-pago-total)"),
          estornado: withAlpha("var(--fin-estornado)"),
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
        gold: "0 0 0 1px var(--si-gold-border), 0 4px 20px rgba(58,169,154,0.18)",
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(58,169,154,0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(58,169,154,0.16)" },
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
