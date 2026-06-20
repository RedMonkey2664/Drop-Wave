"use client";

/**
 * DropLogo — the brand drop mark, restyled for the "Structured" editorial system
 * (flat, monochrome ink on putty — see DESIGN.md / tokens.ts). It is now a literal,
 * elegant interpretation of the tagline "Drop a file. It lands anywhere.": a falling
 * droplet above two ripple arcs (the surface it lands on).
 *
 * Monochrome by design — it draws in `currentColor`, so it inherits the ink text color
 * wherever it sits (file picker, radar center, hero) and never reintroduces an
 * off-palette accent. The previous version hardcoded an aqua→violet gradient, which
 * clashed badly with the putty/ink theme; that is the "blue icon" this replaces.
 *
 * Same name/props as before (size, pulse, className) so every call site updates at once.
 * When `pulse` is set the droplet gently falls and the ripples breathe; reduced motion
 * holds everything still.
 */

import { motion as m, useReducedMotion } from "framer-motion";

export function DropLogo({
  size = 32,
  pulse = false,
  className,
}: {
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const animate = pulse && !reduce;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className ?? "text-ink"}
      role="img"
      aria-label="DropWave logo"
    >
      {/* falling droplet — gently bobs when pulsing */}
      <m.g
        animate={animate ? { y: [0, 2.5, 0] } : undefined}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box" }}
      >
        <path
          d="M24 7C24 7 32 17.5 32 24.2C32 28.6 28.4 32 24 32C19.6 32 16 28.6 16 24.2C16 17.5 24 7 24 7Z"
          fill="currentColor"
          fillOpacity="0.1"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* soft inner highlight gives the drop a little dimension */}
        <path
          d="M21 23.5C21 21.7 21.9 20.1 23 19"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </m.g>

      {/* ripple arcs — the surface the drop lands on; breathe outward when pulsing */}
      <m.path
        d="M14.5 38.5C17.5 41 30.5 41 33.5 38.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        animate={animate ? { opacity: [0.85, 0.35, 0.85], scale: [1, 1.06, 1] } : undefined}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "view-box", transformOrigin: "center" }}
      />
      <m.path
        d="M18.5 42.5C20.5 44 27.5 44 29.5 42.5"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinecap="round"
        animate={animate ? { opacity: [0.5, 0.15, 0.5], scale: [1, 1.12, 1] } : undefined}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{ transformBox: "view-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
