"use client";

/**
 * FilePicker — choose files to send. Drag-and-drop on desktop, native pickers on mobile.
 *
 * Two explicit entry points, because of an iOS Safari quirk: a generic
 * `<input type="file" multiple>` (no `accept`) often opens the single-item photo path,
 * so picking *several* videos in one go fails. An input that explicitly accepts media
 * (`accept="image/*,video/*"`) instead opens iOS's native Photos grid with multi-select
 * checkmarks — the reliable way to grab many videos at once. We keep a second generic
 * input so non-media files ("anything") still work.
 *
 * Both inputs carry `multiple`; on desktop both just open the normal file dialog.
 *
 * Drag-over pulses the border (ANIMATION.md §4). Empty state shows a floating droplet.
 */

import { useRef, useState } from "react";
import { motion as m, useReducedMotion } from "framer-motion";
import { Images, Paperclip } from "lucide-react";
import { DropLogo } from "@/components/motion/DropLogo";
import { cn } from "@/lib/utils";

export function FilePicker({ onFiles }: { onFiles: (files: File[]) => void }) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const anyInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const reduce = useReducedMotion();

  function handleFiles(list: FileList | null, input?: HTMLInputElement | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
    // Reset so re-selecting the same files fires `change` again.
    if (input) input.value = "";
  }

  // Buttons live inside the clickable zone; stop their taps from also opening the
  // generic picker (the zone's own onClick).
  function open(ref: React.RefObject<HTMLInputElement>) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      ref.current?.click();
    };
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Choose files to send, or drag and drop them here"
      onClick={() => mediaInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          mediaInputRef.current?.click();
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
          Pick several photos &amp; videos at once, or any other files
        </p>
        <p className="mt-1 text-xs text-graphite/70">
          On iPhone: in the photo grid, <span className="font-medium text-ink/80">drag
          one finger across the thumbnails</span> to select many videos in one sweep.
        </p>
      </div>

      {/* Explicit entry points. "Photos & videos" routes to iOS's multi-select grid. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={open(mediaInputRef)}
          className="inline-flex h-10 items-center gap-2 rounded-button bg-ink px-5 text-[13px] font-medium text-paper transition-colors hover:bg-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 focus-visible:ring-offset-2 focus-visible:ring-offset-putty"
        >
          <Images size={16} /> Photos &amp; videos
        </button>
        <button
          type="button"
          onClick={open(anyInputRef)}
          className="inline-flex h-10 items-center gap-2 rounded-button border border-ink/80 bg-transparent px-5 text-[13px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 focus-visible:ring-offset-2 focus-visible:ring-offset-putty"
        >
          <Paperclip size={15} /> Other files
        </button>
      </div>

      {/* Media picker: accept image/* + video/* so iOS opens the multi-select Photos grid. */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files, e.target)}
      />
      {/* Generic picker: no accept, so any file type can be chosen. */}
      <input
        ref={anyInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files, e.target)}
      />
    </div>
  );
}
