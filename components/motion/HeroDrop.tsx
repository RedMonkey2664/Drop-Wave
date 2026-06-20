"use client";

/**
 * HeroDrop — "The Drop" (ANIMATION.md §3.1). A droplet falls from top center, impacts
 * with a squash, throws an expanding ripple ring, and that ripple morphs into the
 * device radar. Loops every ~6s.
 *
 * Built with Framer Motion over transform/opacity only (GPU-friendly). Reduced motion:
 * a still droplet logo with a gentle opacity fade-in, no fall/ripple.
 */

import { motion as m, useReducedMotion } from "framer-motion";
import { motion as tokens } from "@/lib/theme/tokens";
import { DropLogo } from "./DropLogo";
import { Radar } from "./Radar";

export function HeroDrop({ size = 300 }: { size?: number }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <m.div
        className="grid place-items-center"
        style={{ width: size, height: size }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7 }}
      >
        <DropLogo size={size * 0.4} />
      </m.div>
    );
  }

  // One 6s loop: fall (0–0.7s) → impact ripple (0.7–1.9s) → radar holds, then repeat.
  const LOOP = 6;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* The persistent radar that the ripple "becomes". */}
      <div className="absolute inset-0 grid place-items-center">
        <Radar size={size} />
      </div>

      {/* Falling droplet — translateY + surface-tension scaleY stretch, then squash. */}
      <m.div
        className="absolute"
        style={{ top: 0 }}
        initial={false}
        animate={{
          y: [-size * 0.5, size * 0.5 - 10, size * 0.5 - 10, -size * 0.5],
          scaleY: [1.3, 1.3, 0.7, 1.3],
          scaleX: [0.8, 0.9, 1.3, 0.8],
          opacity: [1, 1, 0, 0],
        }}
        transition={{
          duration: LOOP,
          times: [0, 0.12, 0.18, 1],
          ease: tokens.ease.liquid,
          repeat: Infinity,
        }}
      >
        <DropLogo size={size * 0.16} />
      </m.div>

      {/* Impact ripple that expands and fades — the morph into radar. */}
      <m.div
        className="absolute rounded-full border border-aqua/40"
        style={{ width: size * 0.3, height: size * 0.3 }}
        animate={{
          scale: [0, 0, 3, 3],
          opacity: [0, 0.7, 0, 0],
        }}
        transition={{
          duration: LOOP,
          times: [0, 0.18, 0.42, 1],
          ease: tokens.ease.liquid,
          repeat: Infinity,
        }}
      />
    </div>
  );
}
