/**
 * client.ts — WebSocket signaling client.
 *
 * Thin wrapper around the room-based relay in server/signaling. It carries ONLY the
 * WebRTC handshake (SDP/ICE) plus room join/leave + peer presence events. No file data
 * ever flows through here.
 */

export type SignalingEvent =
  | { type: "open" }
  | { type: "joined"; peers: number; initiator: boolean }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "signal"; data: unknown }
  | { type: "room-full" }
  | { type: "error"; reason?: string }
  | { type: "close" };

type Listener = (event: SignalingEvent) => void;

export interface SignalingClientOptions {
  url: string;
  /** Auto-reconnect during the handshake phase if the socket drops. */
  reconnect?: boolean;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private room: string | null = null;
  private closedByUs = false;
  private reconnectAttempts = 0;
  private readonly url: string;
  private readonly reconnect: boolean;

  constructor(opts: SignalingClientOptions) {
    this.url = opts.url;
    this.reconnect = opts.reconnect ?? true;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SignalingEvent) {
    for (const l of this.listeners) l(event);
  }

  connect() {
    this.closedByUs = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this.emit({ type: "error", reason: "ws-construct-failed" });
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit({ type: "open" });
      // If we were already in a room (reconnect case), re-join it.
      if (this.room) this.send({ type: "join", room: this.room });
    };

    this.ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "joined":
          this.emit({ type: "joined", peers: msg.peers, initiator: !!msg.initiator });
          break;
        case "peer-joined":
          this.emit({ type: "peer-joined" });
          break;
        case "peer-left":
          this.emit({ type: "peer-left" });
          break;
        case "signal":
          this.emit({ type: "signal", data: msg.data });
          break;
        case "room-full":
          this.emit({ type: "room-full" });
          break;
        case "error":
          this.emit({ type: "error", reason: msg.reason });
          break;
      }
    };

    this.ws.onclose = () => {
      this.emit({ type: "close" });
      if (!this.closedByUs && this.reconnect && this.reconnectAttempts < 5) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = () => {
      this.emit({ type: "error", reason: "ws-error" });
    };
  }

  join(room: string) {
    this.room = room;
    this.send({ type: "join", room });
  }

  /** Relay a handshake blob (SDP/ICE) to the other peer. */
  signal(data: unknown) {
    this.send({ type: "signal", data });
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  get isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closedByUs = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({ type: "leave" });
    }
    this.ws?.close();
    this.ws = null;
    this.room = null;
  }
}

/** Resolve the signaling URL from env, with a sane localhost dev default. */
export function getSignalingUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SIGNALING_URL;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    // Dev fallback: same host, port 8080, ws/wss to match the page protocol.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.hostname}:8080`;
  }
  return "ws://localhost:8080";
}

/** STUN servers for ICE. STUN only helps peers discover their public address; it
 * relays no data. On the same Wi-Fi the connection stays fully local. */
export function getIceServers(): RTCIceServer[] {
  const fromEnv = process.env.NEXT_PUBLIC_STUN_URLS;
  const urls = fromEnv
    ? fromEnv.split(",").map((u) => u.trim()).filter(Boolean)
    : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];
  return [{ urls }];
}
