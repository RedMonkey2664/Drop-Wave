"use client";

/**
 * Wordmark — the DropWave name in the editorial serif. The system is monochrome, so
 * the brand split is TONAL, not colored: "Drop" in ink, "Wave" in graphite (with the
 * Davinci-style move of setting the second word in italic for emphasis). The split
 * point is derived from BRAND.name so the brand stays swappable from one constant.
 */

import { BRAND } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  italicSecond = false,
}: {
  className?: string;
  /** kept for API compatibility */
  shimmer?: boolean;
  italicSecond?: boolean;
}) {
  const name = BRAND.name;
  const splitAt = name.indexOf("W", 1) > 0 ? name.indexOf("W", 1) : Math.ceil(name.length / 2);
  const first = name.slice(0, splitAt);
  const second = name.slice(splitAt);

  return (
    <span className={cn("font-display font-medium tracking-display", className)}>
      <span className="text-ink">{first}</span>
      <span className={cn("text-graphite", italicSecond && "italic")}>{second}</span>
    </span>
  );
}
