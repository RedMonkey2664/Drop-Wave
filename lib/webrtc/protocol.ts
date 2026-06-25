/**
 * protocol.ts — the DropWave DataChannel transfer protocol.
 *
 * Two message classes travel over the encrypted WebRTC DataChannel:
 *   1. CONTROL messages — small JSON strings (metadata, acks, cancels).
 *   2. DATA messages    — raw binary ArrayBuffers (the actual file chunks).
 *
 * Because an SCTP DataChannel is ordered + reliable by default, we can interleave a
 * `file-start` control message, then that file's chunks in order, then `file-end`,
 * then the next file. The receiver always knows the "current" file is the most recent
 * `file-start`. No per-chunk framing/headers are needed, which keeps throughput high.
 */

/**
 * Chunk size. 16 KiB is the cross-browser-safe SCTP floor (older stacks, incl. some iOS
 * Safari versions, choke above it). But on capable peers, bigger chunks mean far less
 * per-message overhead — decisive when moving 100 GB across thousands of files. So this
 * is the FLOOR/fallback; the sender negotiates the real size up from the channel's
 * SCTP `maxMessageSize` (see CHUNK_SIZE_MIN/MAX and FileSender), clamped to a value
 * every modern browser handles. We never go below CHUNK_SIZE so iOS Safari stays happy.
 */
export const CHUNK_SIZE = 16 * 1024;
export const CHUNK_SIZE_MIN = 16 * 1024; // 16 KiB — iOS-Safari-safe floor
export const CHUNK_SIZE_MAX = 256 * 1024; // 256 KiB — fast, still widely supported
export const CHUNK_SIZE_TARGET = 64 * 1024; // used when maxMessageSize is unknown

/**
 * Backpressure thresholds for channel.bufferedAmount. We stop feeding the channel above
 * HIGH_WATER and resume (via `bufferedamountlow`) below LOW_WATER, keeping memory bounded
 * and the UI smooth even across 100 GB. Raised for higher sustained desktop throughput.
 */
export const BUFFER_HIGH_WATER = 16 * 1024 * 1024; // 16 MB
export const BUFFER_LOW_WATER = 4 * 1024 * 1024; // 4 MB

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
}

export type ControlMessage =
  | { kind: "batch-start"; files: FileMeta[]; totalBytes: number }
  | { kind: "file-start"; meta: FileMeta }
  | { kind: "file-end"; id: string }
  | { kind: "batch-complete" }
  // Receiver -> sender acks (used for accurate "received" state + future flow control).
  | { kind: "file-received"; id: string }
  | { kind: "batch-received" }
  // Either side can cancel a file or the whole batch.
  | { kind: "cancel"; id?: string };

export function encodeControl(msg: ControlMessage): string {
  return JSON.stringify(msg);
}

export function decodeControl(data: string): ControlMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.kind === "string") return parsed as ControlMessage;
    return null;
  } catch {
    return null;
  }
}
