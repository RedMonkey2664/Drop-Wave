"use client";

/**
 * Button — the one button primitive ("Structured" editorial restyle).
 *
 * Flat, monochrome, no glow/gradient:
 *   • primary   → filled ink pill, paper text, compact capsule (28.8px radius).
 *   • secondary → hairline-bordered pill on the warm canvas.
 *   • ghost     → text-only link, underline on hover (nav / inline links).
 *
 * Motion is restrained to match the system: a small press scale and a quiet pointer
 * ripple on filled buttons. Reduced motion drops both.
 */

import { forwardRef, useRef, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

/** Omit the DOM event handlers whose signatures collide with Framer Motion's. */
type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "ref" | "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
> & {
  variant?: Variant;
  size?: Size;
};

const base =
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden font-sans " +
  "select-none transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ink/60 focus-visible:ring-offset-2 focus-visible:ring-offset-putty " +
  "disabled:opacity-40 disabled:pointer-events-none";

const sizes: Record<Size, string> = {
  md: "h-9 rounded-button px-4 text-[13px]",
  lg: "h-12 rounded-button px-7 text-[15px]",
};

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper font-medium hover:bg-graphite",
  secondary:
    "bg-transparent text-ink font-medium border border-ink/80 hover:bg-ink hover:text-paper rounded-button",
  ghost:
    "px-1 text-ink/80 font-medium underline-offset-4 hover:text-ink hover:underline rounded-link",
};

interface RippleSpec {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, children, onPointerDown, ...rest },
  ref
) {
  const reduce = useReducedMotion();
  const [ripples, setRipples] = useState<RippleSpec[]>([]);
  const counter = useRef(0);
  const filled = variant === "primary";

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!reduce && filled) {
      const rect = e.currentTarget.getBoundingClientRect();
      const sz = Math.max(rect.width, rect.height) * 2;
      const id = counter.current++;
      setRipples((r) => [
        ...r,
        { id, x: e.clientX - rect.left, y: e.clientY - rect.top, size: sz },
      ]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 600);
    }
    onPointerDown?.(e);
  }

  return (
    <m.button
      ref={ref}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      className={cn(base, sizes[size], variants[variant], className)}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {ripples.map((r) => (
        <m.span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-paper/25"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size, marginLeft: -r.size / 2, marginTop: -r.size / 2 }}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </m.button>
  );
});
