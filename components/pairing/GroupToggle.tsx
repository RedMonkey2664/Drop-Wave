"use client";

/**
 * GroupToggle — opt into "group sharing" (up to 4 devices in one room as a full mesh).
 * Editorial monochrome switch: ink track when on, hairline when off, with a spring
 * thumb. Accessible as role="switch"; reduced motion still animates the small thumb
 * shift (transform only).
 */

import { motion as m } from "framer-motion";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "group flex w-full items-center gap-4 rounded-card border bg-bone/60 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
        on ? "border-ink/40 bg-bone" : "border-border-subtle hover:border-ink/30"
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors",
          on ? "border-ink bg-ink text-paper" : "border-border-subtle text-text-secondary"
        )}
      >
        <Users size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">
          Group sharing
        </span>
        <span className="mt-0.5 block text-xs text-text-secondary">
          Share with up to 4 devices at once, all peer-to-peer.
        </span>
      </span>

      {/* the track */}
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-pill border transition-colors",
          on ? "border-ink bg-ink" : "border-border-subtle bg-vellum"
        )}
      >
        <m.span
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-paper shadow-sm"
          animate={{ left: on ? 22 : 3 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
        />
      </span>
    </button>
  );
}
