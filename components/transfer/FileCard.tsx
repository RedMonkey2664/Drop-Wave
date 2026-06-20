"use client";

/**
 * FileCard — one file in transfer. Background is the LiquidProgress fill that rises
 * with real progress; foreground shows name, size, live speed, and status. On
 * completion the border blooms to success and a checkmark draws in (SVG path length),
 * then settles (ANIMATION.md §3.6). A cancel control is offered while in flight.
 */

import { motion as m, useReducedMotion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Download,
  Share2,
  X,
} from "lucide-react";
import { LiquidProgress } from "@/components/motion/LiquidProgress";
import { ProgressUpdate } from "@/lib/webrtc/transfer";
import { cn, formatBytes, formatSpeed } from "@/lib/utils";

export interface FileCardProps {
  file: ProgressUpdate;
  direction: "in" | "out";
  onCancel?: () => void;
  /** Receiver-only actions on completed files. */
  downloadUrl?: string;
  onShare?: () => void;
  canShare?: boolean;
}

export function FileCard({
  file,
  direction,
  onCancel,
  downloadUrl,
  onShare,
  canShare,
}: FileCardProps) {
  const reduce = useReducedMotion();
  const done = file.status === "done";
  const failed = file.status === "error";
  const canceled = file.status === "canceled";
  const active = file.status === "active";
  const pct = Math.round(file.progress * 100);

  return (
    <m.div
      layout={!reduce}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-card border bg-surface/70 p-4 backdrop-blur-md transition-colors",
        done ? "border-success/50 shadow-glow" : "border-border-subtle",
        failed && "border-error/50"
      )}
    >
      <LiquidProgress progress={file.progress} tone={done ? "success" : "aqua"} />

      <div className="relative z-10 flex items-center gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
            done
              ? "border-success/40 text-success"
              : "border-border-subtle text-text-secondary"
          )}
        >
          {done ? (
            reduce ? (
              <Check size={16} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <m.path
                  d="M5 13l4 4L19 7"
                  stroke="#2EE6A8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </svg>
            )
          ) : direction === "out" ? (
            <ArrowUpFromLine size={16} />
          ) : (
            <ArrowDownToLine size={16} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-text-secondary">
            <span>{formatBytes(file.size)}</span>
            {active && file.speed > 0 && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-aqua">{formatSpeed(file.speed)}</span>
              </>
            )}
            {canceled && <span className="text-warning">· canceled</span>}
            {failed && <span className="text-error">· failed</span>}
          </p>
        </div>

        {/* trailing: percent / actions */}
        <div className="flex shrink-0 items-center gap-2">
          {done && downloadUrl ? (
            <>
              {canShare && onShare && (
                <button
                  onClick={onShare}
                  className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60"
                  aria-label={`Share ${file.name}`}
                >
                  <Share2 size={16} />
                </button>
              )}
              <a
                href={downloadUrl}
                download={file.name}
                className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60"
                aria-label={`Download ${file.name}`}
              >
                <Download size={16} />
              </a>
            </>
          ) : done ? (
            <span className="font-mono text-xs text-success">Sent</span>
          ) : (
            <span className="font-mono text-sm tabular-nums text-text-primary">{pct}%</span>
          )}

          {active && onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-elevated hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50"
              aria-label={`Cancel ${file.name}`}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </m.div>
  );
}
