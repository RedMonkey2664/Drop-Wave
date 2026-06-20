"use client";

/**
 * FloatingDrops — ambient micro-droplets that drift slowly upward behind the hero,
 * reinforcing the "drop" identity without stealing focus. Deterministic positions
 * (no hydration mismatch), transform/opacity only, capped count. Disabled under
 * reduced motion.
 */

import { motion as m, useReducedMotion } from "framer-motion";

// Deterministic specs so server and client render identically.
const DROPS = [
  { left: "12%", size: 6, delay: 0, dur: 9, drift: 14 },
  { left: "24%", size: 4, delay: 2.5, dur: 11, drift: -10 },
  { left: "38%", size: 8, delay: 1.2, dur: 12, drift: 18 },
  { left: "57%", size: 5, delay: 3.4, dur: 10, drift: -16 },
  { left: "71%", size: 7, delay: 0.8, dur: 13, drift: 12 },
  { left: "84%", size: 4, delay: 2.0, dur: 10.5, drift: -8 },
  { left: "92%", size: 6, delay: 4.0, dur: 12.5, drift: 16 },
];

export function FloatingDrops() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {DROPS.map((d, i) => (
        <m.span
          key={i}
          className="absolute rounded-full bg-aqua/40 blur-[1px]"
          style={{
            left: d.left,
            bottom: -10,
            width: d.size,
            height: d.size,
            boxShadow: "0 0 8px rgba(0,229,255,0.5)",
          }}
          initial={{ y: 0, x: 0, opacity: 0 }}
          animate={{
            y: [0, -420],
            x: [0, d.drift, -d.drift, 0],
            opacity: [0, 0.8, 0.8, 0],
          }}
          transition={{
            duration: d.dur,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
