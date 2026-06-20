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
 * Chunk size. 16 KiB is the cross-browser-safe SCTP message size (older WebRTC stacks,
 * including some iOS Safari versions, choke above this). Larger is faster but riskier;
 * we trade a little speed for "works iPhone ↔ Windows" reliability — the whole point.
 */
export const CHUNK_SIZE = 16 * 1024;

/**
 * Backpressure thresholds for channel.bufferedAmount. We pause feeding the channel
 * when the send buffer exceeds HIGH_WATER and resume (via the `bufferedamountlow`
 * event) when it drains below LOW_WATER. This keeps memory bounded and the UI smooth
 * even for multi-GB files.
 */
export const BUFFER_HIGH_WATER = 8 * 1024 * 1024; // 8 MB
export const BUFFER_LOW_WATER = 1 * 1024 * 1024; // 1 MB

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
