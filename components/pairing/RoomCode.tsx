"use client";

/**
 * RoomCode — the human-readable pairing fallback (CLAUDE.md "Fallback: short room
 * code"). Two pieces:
 *   • <RoomCodeDisplay> shows the sender's code in big mono with copy-to-clipboard.
 *   • <RoomCodeEntry> lets the receiver type a code when the camera is denied/absent.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { normalizeRoomCode } from "@/lib/utils";

export function RoomCodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked; the code is visible to read aloud regardless.
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-text-muted">
        Room code
      </span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-3xl font-medium tracking-[0.3em] text-text-primary">
          {code}
        </span>
        <button
          onClick={copy}
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-elevated hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/70"
          aria-label="Copy room code"
        >
          {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
        </button>
      </div>
    </div>
  );
}

export function RoomCodeEntry({
  onSubmit,
  autoFocus = false,
}: {
  onSubmit: (code: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");
  const normalized = normalizeRoomCode(value);
  const valid = normalized.length >= 4;

  return (
    <form
      className="flex w-full max-w-sm flex-col items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(normalized);
      }}
    >
      <label htmlFor="room-code" className="sr-only">
        Enter room code
      </label>
      <input
        id="room-code"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={8}
        placeholder="ABC123"
        className="w-full rounded-button border border-border-subtle bg-elevated px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] text-text-primary placeholder:text-text-muted focus-visible:border-aqua/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40"
      />
      <Button type="submit" size="lg" className="w-full" disabled={!valid}>
        Connect
      </Button>
    </form>
  );
}
