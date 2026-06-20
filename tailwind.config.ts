import type { Config } from "tailwindcss";

/**
 * DropWave — "Structured" editorial restyle (warm putty + ink, flat, serif/grotesk).
 *
 * The palette/radii are the single source of truth alongside lib/theme/tokens.ts.
 * We expose the Structured token names (putty, ink, bone, …) for new editorial markup,
 * AND remap the legacy semantic names (abyss, surface, text-primary, aqua, …) onto the
 * new palette so existing functional screens (send/receive/transfer) reskin to the flat
 * light theme without per-line rewrites. If you change a color, change it here.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Structured palette ──
        putty: "#c4c3b6",
        ink: "#000000",
        bone: "#e7e5e4",
        chalk: "#ebebeb",
        vellum: "#dfdcd5",
        graphite: "#595855",
        ash: "#808080",
        paper: "#ffffff",

        // ── Legacy names remapped onto the new palette (keeps old screens working) ──
        abyss: "#c4c3b6", // page canvas → putty
        surface: "#e7e5e4", // cards → bone
        elevated: "#ebebeb", // raised → chalk
        "border-subtle": "#dfdcd5", // hairline → vellum
        aqua: "#000000", // primary accent → ink (flat, monochrome)
        "aqua-deep": "#000000",
        violet: "#595855", // secondary → graphite
        "violet-deep": "#595855",
        "text-primary": "#000000", // ink
        "text-secondary": "#595855", // graphite
        "text-muted": "#808080", // ash
        // functional status colors kept (only surface on transfer screens)
        success: "#3f6f5e",
        warning: "#8a6a2f",
        error: "#9c4a4a",
      },
      borderRadius: {
        card: "9px",
        button: "28.8px",
        link: "2px",
        pill: "999px",
      },
      fontFamily: {
        // Davinci → Playfair Display (serif display). Helvetica Now → Inter (grotesk).
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        serif: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        display: "-0.03em", // tight tracking on huge serif (carved-shape look)
      },
      boxShadow: {
        // Flat system — depth comes from light/dark cuts, not elevation.
        glow: "none",
        "glow-strong": "none",
        "glow-violet": "none",
      },
      backgroundImage: {
        // No gradients in the flat system; keep the token as solid ink so any
        // `bg-liquid-glow bg-clip-text text-transparent` renders as ink text.
        "liquid-glow": "linear-gradient(0deg, #000000, #000000)",
        "ripple-halo":
          "radial-gradient(circle, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 70%)",
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 6s ease-in-out infinite",
        breathe: "breathe 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
