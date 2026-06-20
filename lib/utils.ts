/** Tiny class-name joiner (avoids pulling in clsx for one helper). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/** Bytes-per-second -> "12.3 MB/s". */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** Seconds -> "1m 05s" / "12s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Room code alphabet: unambiguous (no 0/O, 1/I/L). Easy to read aloud / type on a
 * phone keyboard. 6 chars from a 28-symbol set ≈ 4.8e8 combos — plenty for ephemeral
 * pairing without collisions in practice.
 */
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  const out: string[] = [];
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(length);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out.push(ROOM_ALPHABET[buf[i] % ROOM_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]);
    }
  }
  return out.join("");
}

/** Normalize user-typed room codes (case, stray whitespace). */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Stable-ish id for file entries within a session. */
export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
