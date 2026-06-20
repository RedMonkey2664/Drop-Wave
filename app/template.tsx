"use client";

/**
 * template.tsx — Next.js re-mounts this on every navigation, which makes it the right
 * place for the page-transition motion from ANIMATION.md §4: a crossfade + 12px rise
 * with the liquid ease. Reduced motion degrades to a plain crossfade.
 */

import { motion as m, useReducedMotion } from "framer-motion";
import { motion as tokens } from "@/lib/theme/tokens";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: tokens.duration.base, ease: tokens.ease.liquid }}
    >
      {children}
    </m.div>
  );
}
