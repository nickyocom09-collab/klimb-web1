/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables (space-separated RGB) so the theme can swap
        // between dark and light at runtime via [data-theme] on <html>.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        chalk: "rgb(var(--c-chalk) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-dim": "rgb(var(--c-accent-dim) / <alpha-value>)",
        tight: "rgb(var(--c-accent) / <alpha-value>)",
        wide: "rgb(var(--c-wide) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      maxWidth: {
        app: "480px",
      },
      boxShadow: {
        // Soft elevation that reads on both dark and light surfaces.
        card: "0 1px 2px rgb(0 0 0 / 0.18), 0 8px 24px -12px rgb(0 0 0 / 0.45)",
        glow: "0 0 0 1px rgb(var(--c-accent) / 0.25), 0 8px 32px -8px rgb(var(--c-accent) / 0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.5", transform: "scale(0.9)" },
          "70%": { opacity: "0", transform: "scale(1.6)" },
          "100%": { opacity: "0", transform: "scale(1.6)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.4)" },
          "60%": { opacity: "1", transform: "scale(1.12)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        confetti: {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "1" },
          "100%": {
            transform: "translateY(105vh) rotate(540deg)",
            opacity: "0.7",
          },
        },
        "grow-bar": {
          from: { width: "0%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.25s ease-out both",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        pop: "pop 0.45s cubic-bezier(0.34, 1.4, 0.5, 1) both",
        confetti: "confetti 2.6s ease-in both",
        "grow-bar": "grow-bar 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
