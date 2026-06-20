/**
 * Badge — small pill for trust signals + status (Offline, Encrypted, Connected…).
 * Quiet by default; semantic tones for status states.
 */

import { cn } from "@/lib/utils";

type Tone = "neutral" | "aqua" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  neutral: "border-border-subtle bg-elevated/60 text-text-secondary",
  aqua: "border-aqua/30 bg-aqua/10 text-aqua",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-error/30 bg-error/10 text-error",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-medium tracking-[0.02em]",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
