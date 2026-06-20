"use client";

/**
 * Radar — "Radar Pulse" (ANIMATION.md §3.2). Concentric rings emanate outward from a
 * center droplet while waiting for a peer: "broadcasting, looking for a device."
 *
 * Performance: animates only transform (scale) + opacity. Caps concurrent rings at 3.
 * Reduced motion: rings hold static with a quiet opacity breathe instead of expanding.
 */

import { motion as m, useReducedMotion } from "framer-motion";
import { DropLogo } from "./DropLogo";

export function Radar({
  size = 260,
  active = true,
}: {
  size?: number;
  active?: boolean;
}) {
  const reduce = useReducedMotion();
  const rings = [0, 1, 2]; // capped at 3 concurrent rings

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {rings.map((i) =>
        reduce ? (
          <div
            key={i}
            className="absolute rounded-full border border-aqua/20 animate-breathe"
            style={{ width: size * (0.4 + i * 0.28), height: size * (0.4 + i * 0.28) }}
          />
        ) : (
          <m.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background:
                "radial-gradient(circle, rgba(0,229,255,0.18) 0%, rgba(108,99,255,0) 70%)",
              border: "1px solid rgba(0,229,255,0.25)",
            }}
            initial={{ scale: 0.25, opacity: 0 }}
            animate={
              active
                ? { scale: [0.25, 1], opacity: [0, 0.55, 0] }
                : { scale: 0.25, opacity: 0 }
            }
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeOut",
              delay: i * 0.8, // stagger the three rings
            }}
          />
        )
      )}

      {/* center droplet gently bobs */}
      <m.div
        className="relative z-10"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <DropLogo size={size * 0.22} pulse />
      </m.div>
    </div>
  );
}
