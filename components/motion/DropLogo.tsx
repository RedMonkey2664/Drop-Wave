"use client";

/**
 * Logo mark — a futuristic "orbit node": a glowing gradient core wrapped by two
 * crossed elliptical orbits (a gyroscope / signal-node look) inside a faint ring.
 * It reads as connectivity + motion rather than a literal water drop, while keeping
 * the brand's aqua→violet Liquid Glow.
 *
 * Kept as `DropLogo` (same name/props: size, pulse, className) so every existing
 * usage — header, radar center, file picker — updates in one place. When `pulse` is
 * set the orbit assembly slowly rotates like a gyroscope; reduced motion holds still.
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
  const spin = pulse && !reduce;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="DropWave logo"
    >
      <defs>
        <linearGradient id="dw-core" x1="10" y1="10" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E5FF" />
          <stop offset="1" stopColor="#6C63FF" />
        </linearGradient>
      </defs>

      {/* faint structural ring */}
      <circle cx="24" cy="24" r="21.5" stroke="#00E5FF" strokeOpacity="0.16" strokeWidth="1" />

      {/* crossed orbits — slowly spin as a gyroscope when pulsing */}
      <m.g
        animate={spin ? { rotate: 360 } : undefined}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <g transform="rotate(-26 24 24)">
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke="url(#dw-core)" strokeWidth="1.6" opacity="0.9" />
          <circle cx="43" cy="24" r="2.3" fill="#00E5FF" />
          <circle cx="5" cy="24" r="1.5" fill="#6C63FF" />
        </g>
        <g transform="rotate(26 24 24)">
          <ellipse cx="24" cy="24" rx="19" ry="7" stroke="url(#dw-core)" strokeWidth="1.6" opacity="0.9" />
          <circle cx="43" cy="24" r="1.5" fill="#6C63FF" />
          <circle cx="5" cy="24" r="2.3" fill="#00E5FF" />
        </g>
      </m.g>

      {/* glowing core node */}
      <m.circle
        cx="24"
        cy="24"
        r="6.5"
        fill="url(#dw-core)"
        animate={spin ? { scale: [1, 1.12, 1], opacity: [0.92, 1, 0.92] } : undefined}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle cx="21.6" cy="21.6" r="1.8" fill="#F5F7FA" fillOpacity="0.55" />
    </svg>
  );
}
