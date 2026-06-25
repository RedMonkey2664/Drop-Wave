"use client";

/**
 * FilePicker — choose files to send. Drag-and-drop on desktop, native picker on mobile.
 *
 * iOS Safari note (important): we deliberately use a plain `<input type="file" multiple>`
 * with NO `accept` attribute. Setting `accept="image/*"`/`"video/*"` makes iOS *convert*
 * every selected asset at pick time (HEIC→JPEG, HEVC→H.264). For many large videos that
 * conversion exhausts memory and WebKit kills the tab ("Safari closes by itself"). A
 * generic input hands over the ORIGINAL files without that transcode — and modern iOS
 * still lets you multi-select from the Photo Library. Combined with the streaming sender
 * (see lib/webrtc/transfer.ts), this keeps memory flat while sending many big videos.
 *
 * Drag-over pulses the border (ANIMATION.md §4). Empty state shows a floating droplet.
 */

import { useRef, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import { DropLogo } from "@/components/motion/DropLogo";
import { cn } from "@/lib/utils";

export function FilePicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const reduce = useReducedMotion();

  function handleFiles(list: FileList | null, input?: HTMLInputElement | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
    // Reset so re-selecting the same files fires `change` again.
    if (input) input.value = "";
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
        "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-card border border-dashed px-6 py-16 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-putty",
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
          Pick photos, videos, or any files — select several at once
        </p>
        <p className="mt-1 text-xs text-graphite/70">
          On iPhone, choose <span className="font-medium text-ink/80">Photo Library</span> and
          tap the videos you want. Sharing a lot of big videos? Add them in{" "}
          <span className="font-medium text-ink/80">batches of ~10</span> so Safari stays
          comfortable — they all join the same transfer.
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="inline-flex h-10 items-center gap-2 rounded-button bg-ink px-5 text-[13px] font-medium text-paper transition-colors hover:bg-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 focus-visible:ring-offset-2 focus-visible:ring-offset-putty"
      >
        <FolderOpen size={16} /> Choose files
      </button>

      {/* Generic multiple picker — NO `accept`, so iOS sends originals without the
          memory-heavy HEIC/HEVC conversion that crashes Safari on big multi-video picks. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files, e.target)}
      />
    </div>
  );
}
