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
import { UploadCloud } from "lucide-react";
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
        "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed px-6 py-14 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60",
        dragOver
          ? "border-aqua bg-aqua/5 shadow-glow"
          : "border-border-subtle hover:border-aqua/40"
      )}
    >
      <m.div
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <DropLogo size={56} pulse />
      </m.div>

      <div>
        <p className="flex items-center justify-center gap-2 text-base font-medium text-text-primary">
          <UploadCloud size={18} className="text-aqua" />
          {dragOver ? "Release to add files" : "Drop files here"}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          or <span className="text-aqua">browse</span> — photos, videos, anything
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
