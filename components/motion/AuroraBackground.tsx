"use client";

/**
 * AuroraBackground — a fixed, site-wide ambient layer of slow-drifting liquid-glow
 * blobs behind all content. This is the "calm, then alive" resting state (DESIGN.md
 * §1): mostly still, dark, with a faint living glow that gives the near-black canvas
 * depth without ever becoming a flat colored background.
 *
 * Performance: only `transform` (x/y/scale) is animated, so each blurred blob is
 * rasterized once and moved on the GPU — cheap even on mobile. Reduced motion holds
 * the blobs still.
 */

import { motion as m, useReducedMotion } from "framer-motion";

const BLOBS = [
  {
    color: "rgba(0,229,255,0.10)",
    size: 620,
    top: "-14%",
    left: "6%",
    dur: 24,
    x: [0, 70, -40, 0],
    y: [0, 50, -30, 0],
    s: [1, 1.12, 0.95, 1],
  },
  {
    color: "rgba(108,99,255,0.11)",
    size: 560,
    top: "26%",
    left: "60%",
    dur: 30,
    x: [0, -60, 40, 0],
    y: [0, -40, 50, 0],
    s: [1, 0.92, 1.1, 1],
  },
  {
    color: "rgba(0,145,234,0.08)",
    size: 520,
    top: "66%",
    left: "14%",
    dur: 34,
    x: [0, 50, -50, 0],
    y: [0, -50, 30, 0],
    s: [1, 1.08, 0.96, 1],
  },
];

export function AuroraBackground() {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {BLOBS.map((b, i) => (
        <m.div
          key={i}
          className="absolute rounded-full blur-3xl will-change-transform"
          style={{
            width: b.size,
            height: b.size,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
          }}
          animate={reduce ? undefined : { x: b.x, y: b.y, scale: b.s }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* fine top vignette to seat content against the canvas */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}
