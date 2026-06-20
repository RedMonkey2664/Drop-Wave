"use client";

/**
 * FilePicker — choose files to send. Drag-and-drop on desktop, native file/photo
 * picker on mobile (the same <input type=file> drives both; the tap target is the
 * whole zone). Drag-over pulses the border aqua (ANIMATION.md §4).
 *
 * Empty state: an inviting drop zone with a gently floating droplet (DESIGN.md §8).
 */

import { useRef, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
import { DropLogo } from "@/components/motion/DropLogo";
import { cn } from "@/lib/utils";

export function FilePicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const reduce = useReducedMotion();

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose files to send, or drag and drop them here"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-card border border-dashed px-6 py-20 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-putty",
        dragOver
          ? "border-ink bg-bone"
          : "border-ink/25 hover:border-ink/50 hover:bg-bone/40"
      )}
    >
      {/* the drop mark sits in a soft circular well that subtly lifts on hover/drag */}
      <m.div
        className={cn(
          "grid h-24 w-24 place-items-center rounded-full border border-ink/10 bg-bone/60 text-ink transition-colors duration-300",
          dragOver && "border-ink/30 bg-paper"
        )}
        animate={reduce ? undefined : { y: dragOver ? -2 : [0, -6, 0] }}
        transition={
          dragOver
            ? { duration: 0.3 }
            : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <DropLogo size={52} pulse />
      </m.div>

      <div>
        <p className="font-display text-xl font-semibold tracking-tight text-ink">
          {dragOver ? "Release to drop" : "Drop files here"}
        </p>
        <p className="mt-1.5 text-sm text-graphite">
          or <span className="font-medium text-ink underline decoration-ink/30 underline-offset-4">browse</span>
          {" "}— photos, videos, anything
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
