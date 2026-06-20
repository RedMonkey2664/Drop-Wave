/**
 * transfer.ts — chunked file transfer over an open DataChannel.
 *
 * Sender side: reads each File chunk-by-chunk via Blob.slice (never loads the whole
 * file into memory), respects DataChannel backpressure (bufferedAmount), and emits
 * progress. Receiver side: reassembles chunks into a Blob per file and emits progress.
 *
 * Memory + UI safety (CLAUDE.md "very large files must not freeze the UI"):
 *   • We slice + read one chunk at a time and `await` it, yielding to the event loop
 *     so animations keep running at 60fps during transfer.
 *   • Backpressure caps the send buffer (BUFFER_HIGH_WATER) so RAM stays bounded.
 *   • The receiver keeps an array of ArrayBuffers and only materializes a Blob at
 *     file-end — Blobs reference their parts without a giant copy, and this path works
 *     on iOS Safari (which lacks the File System Access API for streaming-to-disk).
 */

import {
  BUFFER_HIGH_WATER,
  BUFFER_LOW_WATER,
  CHUNK_SIZE,
  ControlMessage,
  decodeControl,
  encodeControl,
  FileMeta,
} from "./protocol";
import { makeId } from "@/lib/utils";

export interface ProgressUpdate {
  id: string;
  name: string;
  size: number;
  type: string;
  transferred: number;
  /** 0..1 */
  progress: number;
  /** bytes/sec, smoothed */
  speed: number;
  status: "pending" | "active" | "done" | "error" | "canceled";
}

export interface ReceivedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SENDER
// ─────────────────────────────────────────────────────────────────────────────

export class FileSender {
  private canceled = new Set<string>();
  private batchCanceled = false;

  constructor(
    private channel: RTCDataChannel,
    private onProgress: (u: ProgressUpdate) => void
  ) {
    this.channel.bufferedAmountLowThreshold = BUFFER_LOW_WATER;
  }

  cancel(id?: string) {
    if (id) this.canceled.add(id);
    else this.batchCanceled = true;
    this.send(encodeControl({ kind: "cancel", id }));
  }

  private send(data: string | ArrayBuffer | ArrayBufferView) {
    if (this.channel.readyState === "open") this.channel.send(data as any);
  }

  /** Wait until the send buffer drains below the low-water mark. */
  private waitForDrain(): Promise<void> {
    if (this.channel.bufferedAmount < BUFFER_HIGH_WATER) return Promise.resolve();
    return new Promise((resolve) => {
      const handler = () => {
        this.channel.removeEventListener("bufferedamountlow", handler);
        resolve();
      };
      this.channel.addEventListener("bufferedamountlow", handler);
    });
  }

  /** Send a batch of files sequentially. Resolves when all are sent (or canceled). */
  async sendFiles(files: File[]): Promise<void> {
    const metas: FileMeta[] = files.map((f) => ({
      id: makeId(),
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
    }));
    const totalBytes = metas.reduce((n, m) => n + m.size, 0);
    this.send(encodeControl({ kind: "batch-start", files: metas, totalBytes }));

    for (let i = 0; i < files.length; i++) {
      if (this.batchCanceled) break;
      await this.sendOne(files[i], metas[i]);
    }

    if (!this.batchCanceled) this.send(encodeControl({ kind: "batch-complete" }));
  }

  private async sendOne(file: File, meta: FileMeta) {
    this.send(encodeControl({ kind: "file-start", meta }));

    let offset = 0;
    let transferred = 0;
    // Speed smoothing: exponential moving average over recent throughput.
    let lastTime = performance.now();
    let lastBytes = 0;
    let speed = 0;

    this.onProgress({
      ...meta,
      transferred: 0,
      progress: 0,
      speed: 0,
      status: "active",
    });

    while (offset < file.size) {
      if (this.batchCanceled || this.canceled.has(meta.id)) {
        this.onProgress({
          ...meta,
          transferred,
          progress: meta.size ? transferred / meta.size : 0,
          speed: 0,
          status: "canceled",
        });
        return;
      }

      await this.waitForDrain();

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buf = await slice.arrayBuffer(); // async read — yields to the event loop
      this.send(buf);

      offset += buf.byteLength;
      transferred += buf.byteLength;

      // Update smoothed speed roughly every 200ms to avoid render thrash.
      const now = performance.now();
      const dt = now - lastTime;
      if (dt >= 200) {
        const instantaneous = ((transferred - lastBytes) / dt) * 1000;
        speed = speed === 0 ? instantaneous : speed * 0.7 + instantaneous * 0.3;
        lastTime = now;
        lastBytes = transferred;
        this.onProgress({
          ...meta,
          transferred,
          progress: meta.size ? transferred / meta.size : 1,
          speed,
          status: "active",
        });
      }
    }

    this.send(encodeControl({ kind: "file-end", id: meta.id }));
    this.onProgress({
      ...meta,
      transferred: meta.size,
      progress: 1,
      speed: 0,
      status: "done",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVER
// ─────────────────────────────────────────────────────────────────────────────

interface IncomingFile {
  meta: FileMeta;
  chunks: ArrayBuffer[];
  received: number;
  lastTime: number;
  lastBytes: number;
  speed: number;
}

export interface ReceiverCallbacks {
  onProgress: (u: ProgressUpdate) => void;
  onFileComplete: (file: ReceivedFile) => void;
  onBatchStart?: (files: FileMeta[], totalBytes: number) => void;
  onBatchComplete?: () => void;
  onCancel?: (id?: string) => void;
}

export class FileReceiver {
  private current: IncomingFile | null = null;
  /** Ack channel back to the sender (optional but improves UX accuracy). */
  private ack: (msg: ControlMessage) => void;

  constructor(private callbacks: ReceiverCallbacks, ackSend: (data: string) => void) {
    this.ack = (msg) => ackSend(encodeControl(msg));
  }

  /** Feed every DataChannel message here; we route control vs. binary. */
  handleMessage(data: string | ArrayBuffer) {
    if (typeof data === "string") {
      const msg = decodeControl(data);
      if (msg) this.handleControl(msg);
      return;
    }
    this.handleChunk(data);
  }

  private handleControl(msg: ControlMessage) {
    switch (msg.kind) {
      case "batch-start":
        this.callbacks.onBatchStart?.(msg.files, msg.totalBytes);
        // Seed pending progress rows so the UI lists files immediately.
        for (const meta of msg.files) {
          this.callbacks.onProgress({
            ...meta,
            transferred: 0,
            progress: 0,
            speed: 0,
            status: "pending",
          });
        }
        break;
      case "file-start":
        this.current = {
          meta: msg.meta,
          chunks: [],
          received: 0,
          lastTime: performance.now(),
          lastBytes: 0,
          speed: 0,
        };
        this.callbacks.onProgress({
          ...msg.meta,
          transferred: 0,
          progress: 0,
          speed: 0,
          status: "active",
        });
        break;
      case "file-end":
        this.finishCurrent();
        break;
      case "batch-complete":
        this.callbacks.onBatchComplete?.();
        this.ack({ kind: "batch-received" });
        break;
      case "cancel":
        if (this.current && (!msg.id || msg.id === this.current.meta.id)) {
          this.callbacks.onProgress({
            ...this.current.meta,
            transferred: this.current.received,
            progress: this.current.meta.size
              ? this.current.received / this.current.meta.size
              : 0,
            speed: 0,
            status: "canceled",
          });
          this.current = null;
        }
        this.callbacks.onCancel?.(msg.id);
        break;
    }
  }

  private handleChunk(buf: ArrayBuffer) {
    const cur = this.current;
    if (!cur) return; // stray chunk without a file-start; ignore defensively
    cur.chunks.push(buf);
    cur.received += buf.byteLength;

    const now = performance.now();
    const dt = now - cur.lastTime;
    if (dt >= 200) {
      const instantaneous = ((cur.received - cur.lastBytes) / dt) * 1000;
      cur.speed = cur.speed === 0 ? instantaneous : cur.speed * 0.7 + instantaneous * 0.3;
      cur.lastTime = now;
      cur.lastBytes = cur.received;
      this.callbacks.onProgress({
        ...cur.meta,
        transferred: cur.received,
        progress: cur.meta.size ? cur.received / cur.meta.size : 1,
        speed: cur.speed,
        status: "active",
      });
    }
  }

  private finishCurrent() {
    const cur = this.current;
    if (!cur) return;
    const blob = new Blob(cur.chunks, {
      type: cur.meta.type || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    this.callbacks.onProgress({
      ...cur.meta,
      transferred: cur.meta.size,
      progress: 1,
      speed: 0,
      status: "done",
    });
    this.callbacks.onFileComplete({
      id: cur.meta.id,
      name: cur.meta.name,
      size: cur.meta.size,
      type: cur.meta.type,
      blob,
      url,
    });
    this.ack({ kind: "file-received", id: cur.meta.id });
    this.current = null;
  }
}
