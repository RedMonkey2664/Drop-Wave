"use client";

/**
 * Splash — "Connect Splash" (ANIMATION.md §3.3). A one-shot, ~0.6s celebration the
 * instant two devices pair: a bright droplet splashes outward (ease.splash overshoot)
 * with a brief success-color bloom, then settles.
 *
 * Driven by a `trigger` key (the session's connectNonce). Reduced motion → a simple
 * crossfade with no overshoot. State is never conveyed by motion alone; the calling
 * screen also shows a "Connected" label + color.
 */

import { AnimatePresence, motion as m, useReducedMotion } from "framer-motion";
import { motion as tokens } from "@/lib/theme/tokens";

export function Splash({ trigger }: { trigger: number }) {
  const reduce = useReducedMotion();
  if (trigger <= 0) return null;

  return (
    <AnimatePresence mode="wait">
      <m.div
        key={trigger}
        className="pointer-events-none absolute inset-0 grid place-items-center"
        aria-hidden
      >
        {/* success bloom */}
        <m.div
          className="absolute h-40 w-40 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(46,230,168,0.5) 0%, rgba(46,230,168,0) 70%)",
          }}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: reduce ? 1 : 2.4, opacity: 0 }}
          transition={{ duration: reduce ? 0.4 : 0.7, ease: tokens.ease.liquid }}
        />
        {/* splashing droplet */}
        <m.div
          className="h-10 w-10 rounded-full bg-liquid-glow shadow-glow-strong"
          initial={{ scale: reduce ? 1 : 0.2, opacity: 0 }}
          animate={{ scale: [0.2, 1.3, 1], opacity: [0, 1, 0] }}
          transition={{
            duration: reduce ? 0.4 : 0.6,
            ease: reduce ? "easeOut" : tokens.ease.splash,
          }}
        />
      </m.div>
    </AnimatePresence>
  );
}
