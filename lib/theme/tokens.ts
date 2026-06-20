/**
 * tokens.ts — DropWave design tokens (single source of truth).
 *
 * Per DESIGN.md + ANIMATION.md: colors, motion durations, easing, spacing.
 * Tune the entire product's look/feel from this one file. Tailwind reads the
 * color/spacing/radius scales from here (see tailwind.config.ts), and motion
 * components import `motion`/`spring` directly.
 */

/** Brand name lives in exactly one place so it can be swapped everywhere at once. */
export const BRAND = {
  name: "DropWave",
  tagline: "Drop a file. It lands anywhere.",
} as const;

/**
 * "Structured" palette — warm putty canvas, ink accents, flat monochrome. Depth comes
 * from alternating light/dark sections, never from color or elevation.
 */
export const colors = {
  // Base — warm gallery canvas
  putty: "#c4c3b6",
  bone: "#e7e5e4",
  chalk: "#ebebeb",
  vellum: "#dfdcd5",
  graphite: "#595855",
  ash: "#808080",
  ink: "#000000",
  paper: "#ffffff",

  // Legacy aliases (kept so existing imports resolve)
  abyss: "#c4c3b6",
  surface: "#e7e5e4",
  elevated: "#ebebeb",
  borderSubtle: "#dfdcd5",
  aqua: "#000000",
  aquaDeep: "#000000",
  violet: "#595855",
  violetDeep: "#595855",
  textPrimary: "#000000",
  textSecondary: "#595855",
  textMuted: "#808080",

  // Semantic (functional status only)
  success: "#3f6f5e",
  warning: "#8a6a2f",
  error: "#9c4a4a",
} as const;

export const gradients = {
  /** Flat system — solid ink stands in for the old gradient. */
  liquidGlow: "linear-gradient(0deg, #000000, #000000)",
  rippleHalo: "radial-gradient(circle, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0) 70%)",
} as const;

export const radius = {
  card: "20px",
  button: "14px",
  pill: "999px",
} as const;

/** 8px base spacing scale (px). */
export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;

/**
 * Motion tokens — see ANIMATION.md §2. Framer Motion `ease` arrays are cubic
 * bezier control points; springs are passed straight to `transition`.
 */
export const motion = {
  duration: {
    instant: 0.12,
    fast: 0.24,
    base: 0.4,
    slow: 0.7,
    ambient: 2.4, // looping background ripples
  },
  ease: {
    liquid: [0.22, 1, 0.36, 1] as [number, number, number, number], // easeOutQuint-ish
    splash: [0.34, 1.56, 0.64, 1] as [number, number, number, number], // overshoot for impact
    settle: [0.4, 0, 0.2, 1] as [number, number, number, number], // standard settle
  },
  spring: {
    soft: { type: "spring", stiffness: 120, damping: 18 },
    snappy: { type: "spring", stiffness: 320, damping: 26 },
    bouncy: { type: "spring", stiffness: 260, damping: 12 },
  },
} as const;

export const spring = motion.spring;

/** Shared Framer Motion variants for staggered group reveals (ANIMATION.md §5). */
export const reveal = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  },
  item: {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: motion.duration.base, ease: motion.ease.liquid },
    },
  },
} as const;
