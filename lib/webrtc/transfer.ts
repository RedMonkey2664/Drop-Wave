/**
 * transfer.ts — chunked file transfer over an open DataChannel.
 *
 * Sender: reads each File chunk-by-chunk via Blob.slice (never loads the whole file into
 * memory), respects DataChannel backpressure (bufferedAmount), negotiates the largest safe
 * chunk size from the channel, and emits progress.
 *
 * Receiver: routes each file's chunks into a pluggable SINK:
 *   • DiskSink   — streams chunks straight to a file on disk via the File System Access
 *                  API (a WritableFileStream). Memory stays bounded no matter the size, so
 *                  100 files × 1 GB (100 GB+) is possible. Desktop Chromium/Edge.
 *   • MemorySink — collects chunks into a Blob + object URL (the universal fallback; used on
 *                  iOS Safari / Firefox which lack the File System Access API, and for small
 *                  transfers where holding the file in RAM is fine).
 *
 * Memory + UI safety: chunks are read/written one at a time with `await`, yielding to the
 * event loop so animations stay at 60fps; backpressure caps the send buffer.
 */

import {
  BUFFER_HIGH_WATER,
  BUFFER_LOW_WATER,
  CHUNK_SIZE_MAX,
  CHUNK_SIZE_MIN,
  CHUNK_SIZE_TARGET,
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
  /** Present only for in-memory (MemorySink) files; absent when streamed to disk. */
  blob?: Blob;
  url?: string;
  /** True when the file was streamed straight to a folder on disk. */
  savedToDisk?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINKS — where received bytes land
// ─────────────────────────────────────────────────────────────────────────────

export interface ChunkSink {
  /** Enqueue a chunk (non-blocking; writes are serialized internally). */
  write(chunk: ArrayBuffer): void;
  /** Flush + finalize. Resolves with how the file can be accessed afterward. */
  close(): Promise<{ blob?: Blob; url?: string; savedToDisk: boolean }>;
  /** Tear down without finalizing (cancel). */
  abort(): Promise<void>;
}

/** Collects chunks in memory and materializes a Blob + object URL at close. */
class MemorySink implements ChunkSink {
  private chunks: ArrayBuffer[] = [];
  constructor(private type: string) {}
  write(chunk: ArrayBuffer) {
    this.chunks.push(chunk);
  }
  async close() {
    const blob = new Blob(this.chunks, { type: this.type || "application/octet-stream" });
    this.chunks = [];
    return { blob, url: URL.createObjectURL(blob), savedToDisk: false as const };
  }
  async abort() {
    this.chunks = [];
  }
}

/**
 * Streams chunks directly to a file on disk. Writes are chained off a single promise so
 * they stay ordered and bounded — only the not-yet-flushed tail sits in memory (disk
 * throughput on an SSD far exceeds typical WebRTC throughput, so that tail stays tiny).
 */
class DiskSink implements ChunkSink {
  private chain: Promise<unknown>;
  private writable: any = null;
  constructor(dirHandle: any, fileName: string) {
    this.chain = (async () => {
      const handle = await dirHandle.getFileHandle(fileName, { create: true });
      this.writable = await handle.createWritable();
    })();
  }
  write(chunk: ArrayBuffer) {
    this.chain = this.chain.then(() => this.writable.write(chunk));
  }
  async close() {
    await this.chain;
    await this.writable.close();
    return { savedToDisk: true as const };
  }
  async abort() {
    try {
      await this.chain;
      await this.writable?.abort?.();
    } catch {
      /* best-effort */
    }
  }
}

export type SinkFactory = (meta: FileMeta) => ChunkSink;

/** Build a sink for a file: disk-stream when a folder handle is set, else in-memory. */
export function makeSink(
  meta: FileMeta,
  dirHandle: any | null,
  uniqueName: (name: string) => string
): ChunkSink {
  if (dirHandle) return new DiskSink(dirHandle, uniqueName(meta.name));
  return new MemorySink(meta.type);
}

/** True if this browser can stream downloads straight to a chosen folder. */
export function canStreamToDisk(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// ─────────────────────────────────────────────────────────────────────────────
// SENDER
// ─────────────────────────────────────────────────────────────────────────────

export class FileSender {
  private canceled = new Set<string>();
  private batchCanceled = false;
  private readonly chunkSize: number;

  constructor(
    private channel: RTCDataChannel,
    private onProgress: (u: ProgressUpdate) => void,
    /** Channel's negotiated SCTP maxMessageSize; we pick the biggest safe chunk from it. */
    maxMessageSize = 0
  ) {
    this.channel.bufferedAmountLowThreshold = BUFFER_LOW_WATER;
    const cap =
      maxMessageSize > 0 ? Math.min(maxMessageSize, CHUNK_SIZE_MAX) : CHUNK_SIZE_TARGET;
    this.chunkSize = Math.max(CHUNK_SIZE_MIN, cap);
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

  /**
   * Send a batch of files sequentially. Resolves when all are sent (or canceled).
   *
   * `providedMetas` lets the caller pre-assign each file's id so the SAME file fanned out
   * to multiple peers shares one id — the session aggregates per-peer progress into a
   * single row. When omitted, ids are generated here.
   */
  async sendFiles(files: File[], providedMetas?: FileMeta[]): Promise<void> {
    const metas: FileMeta[] =
      providedMetas ??
      files.map((f) => ({
        id: makeId(),
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
      }));
    const totalBytes = metas.reduce((n, m) => n + m.size, 0);
    this.send(encodeControl({ kind: "batch-start", files: metas, totalBytes }));

    for (let i = 0; i < files.length; i++) {
      if (this.batchCanceled) break;
      // sendOne already isolates per-file failures, but guard here too so a single
      // unexpected throw can never strand the rest of the batch (or skip batch-complete).
      try {
        await this.sendOne(files[i], metas[i]);
      } catch {
        /* file marked errored inside sendOne; keep going */
      }
    }

    if (!this.batchCanceled) this.send(encodeControl({ kind: "batch-complete" }));
  }

  /**
   * Send one file as fixed-size chunks. Returns its final status so the batch loop can
   * react. Per-file failures are isolated: a single unreadable video is flagged and
   * skipped, never aborting the rest of the batch.
   */
  private async sendOne(
    file: File,
    meta: FileMeta
  ): Promise<"done" | "error" | "canceled"> {
    this.send(encodeControl({ kind: "file-start", meta }));

    let transferred = 0;
    // Speed smoothing: exponential moving average over recent throughput.
    let lastTime = performance.now();
    let lastBytes = 0;
    let speed = 0;

    this.onProgress({ ...meta, transferred: 0, progress: 0, speed: 0, status: "active" });

    const report = () => {
      const now = performance.now();
      const dt = now - lastTime;
      if (dt < 200) return; // throttle to ~5 updates/sec to avoid render thrash
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
    };

    try {
      for await (const buf of this.produceChunks(file)) {
        if (this.batchCanceled || this.canceled.has(meta.id)) {
          this.onProgress({
            ...meta,
            transferred,
            progress: meta.size ? transferred / meta.size : 0,
            speed: 0,
            status: "canceled",
          });
          return "canceled";
        }
        await this.waitForDrain();
        this.send(buf);
        transferred += buf.byteLength;
        report();
      }
    } catch {
      // A read or send failed for THIS file after retries. Don't let one bad video kill
      // the whole batch: tell the receiver to discard the partial file, mark this one
      // errored, and return so sendFiles() moves on to the next file.
      this.send(encodeControl({ kind: "cancel", id: meta.id }));
      this.onProgress({
        ...meta,
        transferred,
        progress: meta.size ? transferred / meta.size : 0,
        speed: 0,
        status: "error",
      });
      return "error";
    }

    this.send(encodeControl({ kind: "file-end", id: meta.id }));
    this.onProgress({
      ...meta,
      transferred: meta.size,
      progress: 1,
      speed: 0,
      status: "done",
    });
    return "done";
  }

  /**
   * Yield a file as fixed-size ArrayBuffer chunks.
   *
   * PRIMARY path streams the file top-to-bottom via Blob.stream() — one sequential read.
   * This is the key fix for iPhone videos: a picked video is backed by a live Photos
   * handle that iOS may still be exporting/transcoding (HEVC .mov especially). The old
   * random-access pattern — slice(offset, offset+n).arrayBuffer() at every offset — makes
   * iOS re-seek into that not-yet-stable file thousands of times and frequently fails on
   * large or multiple videos. A single forward stream matches how the file is produced and
   * is far more reliable, so multi-video shares actually go through.
   *
   * FALLBACK (older Safari without Blob.stream) is random-access slicing, each read
   * retried a few times to ride out transient NotReadableError hiccups.
   */
  private async *produceChunks(file: File): AsyncGenerator<ArrayBuffer> {
    const size = this.chunkSize;

    if (typeof (file as any).stream === "function") {
      const reader: ReadableStreamDefaultReader<Uint8Array> = (file as any)
        .stream()
        .getReader();
      try {
        let leftover = new Uint8Array(0);
        for (;;) {
          const { done, value } = await this.readFromReader(reader);
          if (done) break;
          let data: Uint8Array = value as Uint8Array;
          if (leftover.length) {
            const merged = new Uint8Array(leftover.length + data.length);
            merged.set(leftover, 0);
            merged.set(data, leftover.length);
            data = merged;
          }
          let off = 0;
          while (data.length - off >= size) {
            yield data.slice(off, off + size).buffer;
            off += size;
          }
          leftover = data.slice(off); // compact copy of the remainder for the next round
        }
        if (leftover.length) yield leftover.slice().buffer;
      } finally {
        try {
          await reader.cancel();
        } catch {
          /* reader already closed/errored */
        }
      }
      return;
    }

    // Fallback: random-access slices with retries.
    let offset = 0;
    while (offset < file.size) {
      const buf = await this.readSliceWithRetry(file, offset, size);
      if (buf.byteLength === 0) break;
      yield buf;
      offset += buf.byteLength;
    }
  }

  /** reader.read() with a few short retries (iOS export/read hiccups). */
  private async readFromReader(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<{ done: boolean; value?: Uint8Array }> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await reader.read();
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  /** slice().arrayBuffer() with a few short retries (fallback path). */
  private async readSliceWithRetry(
    file: File,
    offset: number,
    size: number
  ): Promise<ArrayBuffer> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await file.slice(offset, offset + size).arrayBuffer();
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw lastErr;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVER
// ─────────────────────────────────────────────────────────────────────────────

interface IncomingFile {
  meta: FileMeta;
  sink: ChunkSink;
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
  private ack: (msg: ControlMessage) => void;
  private sinkFactory: SinkFactory;

  constructor(
    private callbacks: ReceiverCallbacks,
    ackSend: (data: string) => void,
    sinkFactory?: SinkFactory
  ) {
    this.ack = (msg) => ackSend(encodeControl(msg));
    this.sinkFactory = sinkFactory ?? ((meta) => new MemorySink(meta.type));
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
        // Defensive: if a previous file never got a file-end (sender errored mid-file),
        // tear down its partial sink and flag it so we don't leak an open disk writable
        // or leave a row stuck "active".
        if (this.current) {
          const stale = this.current;
          this.current = null;
          void stale.sink.abort();
          this.callbacks.onProgress({
            ...stale.meta,
            transferred: stale.received,
            progress: stale.meta.size ? stale.received / stale.meta.size : 0,
            speed: 0,
            status: "error",
          });
        }
        this.current = {
          meta: msg.meta,
          sink: this.sinkFactory(msg.meta),
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
      case "file-end": {
        // Swap out `current` synchronously so the next file-start can't race the async
        // close(); finalize this file (flush sink → disk/blob) in the background.
        const finishing = this.current;
        this.current = null;
        if (finishing) void this.finish(finishing);
        break;
      }
      case "batch-complete":
        this.callbacks.onBatchComplete?.();
        this.ack({ kind: "batch-received" });
        break;
      case "cancel":
        if (this.current && (!msg.id || msg.id === this.current.meta.id)) {
          const canceling = this.current;
          this.current = null;
          void canceling.sink.abort();
          this.callbacks.onProgress({
            ...canceling.meta,
            transferred: canceling.received,
            progress: canceling.meta.size ? canceling.received / canceling.meta.size : 0,
            speed: 0,
            status: "canceled",
          });
        }
        this.callbacks.onCancel?.(msg.id);
        break;
    }
  }

  private handleChunk(buf: ArrayBuffer) {
    const cur = this.current;
    if (!cur) return; // stray chunk without a file-start; ignore defensively
    cur.sink.write(buf);
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

  private async finish(file: IncomingFile) {
    try {
      const out = await file.sink.close();
      this.callbacks.onProgress({
        ...file.meta,
        transferred: file.meta.size,
        progress: 1,
        speed: 0,
        status: "done",
      });
      this.callbacks.onFileComplete({
        id: file.meta.id,
        name: file.meta.name,
        size: file.meta.size,
        type: file.meta.type,
        blob: out.blob,
        url: out.url,
        savedToDisk: out.savedToDisk,
      });
      this.ack({ kind: "file-received", id: file.meta.id });
    } catch {
      this.callbacks.onProgress({
        ...file.meta,
        transferred: file.received,
        progress: file.meta.size ? file.received / file.meta.size : 0,
        speed: 0,
        status: "error",
      });
    }
  }
}
