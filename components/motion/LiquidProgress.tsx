"use client";

/**
 * LiquidProgress — "Liquid Fill" (ANIMATION.md §3.4). A rising liquid level that fills
 * its parent bottom-to-top, driven by REAL transfer progress (0..1), with an animated
 * wave on the surface. Designed to sit as a background layer inside a FileCard.
 *
 * Performance: the fill height is a single style update; the surface wave is an SVG
 * path translated on the X axis (transform only) — no per-frame React re-renders.
 * Reduced motion: a flat, static fill with no wave (the card also shows a numeric %
 * and status text, so state never depends on motion alone).
 */

import { motion as m, useReducedMotion } from "framer-motion";
import { motion as tokens } from "@/lib/theme/tokens";

export function LiquidProgress({
  progress,
  tone = "aqua",
}: {
  progress: number; // 0..1
  tone?: "aqua" | "success";
}) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(1, progress));
  const heightPct = `${pct * 100}%`;

  const fill =
    tone === "success"
      ? "linear-gradient(180deg, rgba(46,230,168,0.35) 0%, rgba(46,230,168,0.12) 100%)"
      : "linear-gradient(180deg, rgba(0,229,255,0.30) 0%, rgba(108,99,255,0.12) 100%)";
  const waveColor = tone === "success" ? "rgba(46,230,168,0.5)" : "rgba(0,229,255,0.5)";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden>
      {/* the liquid body — height tracks progress */}
      <m.div
        className="absolute inset-x-0 bottom-0"
        style={{ background: fill }}
        animate={{ height: heightPct }}
        transition={{ ease: tokens.ease.liquid, duration: tokens.duration.fast }}
      >
        {/* surface wave — only when motion is allowed and mid-transfer */}
        {!reduce && pct > 0 && pct < 1 && (
          <div className="absolute -top-3 left-0 h-4 w-[200%]">
            <m.svg
              viewBox="0 0 1200 40"
              preserveAspectRatio="none"
              className="h-full w-full"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            >
              <path
                d="M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V40 H0 Z"
                fill={waveColor}
              />
            </m.svg>
          </div>
        )}
      </m.div>
    </div>
  );
}
