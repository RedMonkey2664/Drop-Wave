"use client";

/**
 * TiltCard — a glass card that subtly tilts in 3D toward the pointer and carries a
 * liquid sheen that follows the cursor (ANIMATION.md §4 "Cards: liquid hover states").
 * Premium, restrained: small angles, spring-damped, glow on hover.
 *
 * Only transform (rotateX/rotateY) and a background-position move — both GPU-cheap.
 * Reduced motion / touch: tilt + sheen are disabled, leaving a clean static glass card.
 */

import { useRef } from "react";
import {
  motion as m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { spring } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

const MAX_TILT = 8; // degrees

export function TiltCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rx = useSpring(useMotionValue(0), spring.soft);
  const ry = useSpring(useMotionValue(0), spring.soft);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(0);
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${sheenX}% ${sheenY}%, rgba(0,229,255,0.10), transparent 60%)`;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * MAX_TILT * 2);
    rx.set(-(py - 0.5) * MAX_TILT * 2);
    sheenX.set(px * 100);
    sheenY.set(py * 100);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <m.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={spring.soft}
      className={cn(
        "group relative overflow-hidden rounded-card border border-border-subtle bg-surface/70 backdrop-blur-xl transition-shadow hover:shadow-glow",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className
      )}
    >
      {/* cursor-tracking liquid sheen */}
      {!reduce && (
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: sheen }}
        />
      )}
      <div style={{ transform: "translateZ(40px)" }} className="relative h-full">
        {children}
      </div>
    </m.div>
  );
}
