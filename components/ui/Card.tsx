"use client";

/**
 * Card — flat surface primitive ("Structured" restyle). Bone surface, hairline vellum
 * border, 9px radius. No shadows, blur, or glow — depth in this system comes from
 * light/dark section cuts, not elevation. Optional hover darkens the border subtly.
 */

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  /** kept for API compatibility; flat system ignores glow */
  glow?: boolean;
}

export function Card({ className, hover = false, glow: _glow, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-card border border-vellum bg-bone",
        hover && "transition-colors hover:border-ink/40",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
