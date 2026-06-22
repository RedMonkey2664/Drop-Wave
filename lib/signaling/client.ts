/**
 * client.ts — WebSocket signaling client.
 *
 * Thin wrapper around the room-based relay in server/signaling. It carries ONLY the
 * WebRTC handshake (SDP/ICE) plus room join/leave + peer presence events. No file data
 * ever flows through here.
 */

export type SignalingEvent =
  | { type: "open" }
  // `self` is this peer's id; `peers` are ids already in the room; `capacity` is the
  // room's max occupancy (2 for 1:1, up to 4 for group sharing).
  | { type: "joined"; self: string; peers: string[]; capacity: number }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "signal"; from: string; data: unknown }
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
  private maxPeers = 2;
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
      if (this.room) this.send({ type: "join", room: this.room, maxPeers: this.maxPeers });
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
          this.emit({
            type: "joined",
            self: msg.self,
            peers: Array.isArray(msg.peers) ? msg.peers : [],
            capacity: msg.capacity ?? 2,
          });
          break;
        case "peer-joined":
          this.emit({ type: "peer-joined", peerId: msg.peerId });
          break;
        case "peer-left":
          this.emit({ type: "peer-left", peerId: msg.peerId });
          break;
        case "signal":
          this.emit({ type: "signal", from: msg.from, data: msg.data });
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

  /** Join a room. `maxPeers` (2..4) only takes effect for the first/host joiner. */
  join(room: string, maxPeers = 2) {
    this.room = room;
    this.maxPeers = maxPeers;
    this.send({ type: "join", room, maxPeers });
  }

  /** Relay a handshake blob (SDP/ICE) to ONE specific peer in the room. */
  signal(to: string, data: unknown) {
    this.send({ type: "signal", to, data });
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

/**
 * ICE servers for WebRTC.
 *
 * STUN only helps peers discover their public address; it relays no data, so on the
 * same Wi-Fi the connection stays fully local. But when two users are on DIFFERENT
 * networks behind strict/symmetric NATs, a direct path often can't be punched and the
 * connection needs a TURN relay (the only point where bytes may pass through a server).
 *
 * TURN is optional and OFF by default. To enable it for production (recommended once
 * the app is public on Vercel), set these env vars:
 *   NEXT_PUBLIC_TURN_URLS=turn:your-turn-host:3478,turns:your-turn-host:5349
 *   NEXT_PUBLIC_TURN_USERNAME=...
 *   NEXT_PUBLIC_TURN_CREDENTIAL=...
 */
export function getIceServers(): RTCIceServer[] {
  const splitUrls = (v?: string) =>
    (v ?? "").split(",").map((u) => u.trim()).filter(Boolean);

  const stunUrls = process.env.NEXT_PUBLIC_STUN_URLS
    ? splitUrls(process.env.NEXT_PUBLIC_STUN_URLS)
    : [
        // Several public STUN servers — more reflexive candidates = better odds of a
        // direct cross-network connection before falling back to a TURN relay.
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
      ];

  const servers: RTCIceServer[] = [{ urls: stunUrls }];

  const turnUrls = splitUrls(process.env.NEXT_PUBLIC_TURN_URLS);
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }

  return servers;
}

/**
 * Async ICE resolution. Returns the static servers from getIceServers() and, if a
 * Metered (metered.ca) API key is configured, ALSO fetches fresh, rotating TURN
 * credentials from its REST endpoint and merges them in. Dynamic creds are preferable
 * to hardcoded ones (they rotate and don't go stale), but everything degrades
 * gracefully: if the fetch fails we still return STUN + any static TURN.
 *
 *   NEXT_PUBLIC_METERED_SUBDOMAIN=yourname   (the "<sub>.metered.live" prefix)
 *   NEXT_PUBLIC_METERED_API_KEY=...          (the app's API key; client-safe)
 *
 * Resolved once per session in SessionProvider and passed to every Peer.
 */
export async function resolveIceServers(): Promise<RTCIceServer[]> {
  const servers = getIceServers();

  // Defaults make cross-network TURN work out of the box; env vars override them.
  // This is a Metered (metered.ca) free-tier app key — a CLIENT key by design (it
  // already ships in the browser bundle), rate-limited to the free quota, and
  // rotatable/deletable from the Metered dashboard at any time.
  const subdomain = process.env.NEXT_PUBLIC_METERED_SUBDOMAIN || "dropwave";
  const apiKey =
    process.env.NEXT_PUBLIC_METERED_API_KEY ||
    "0291aa6ec0f479e9e1e55c93a18f101ca035";
  if (!subdomain || !apiKey || typeof fetch === "undefined") return servers;

  try {
    const res = await fetch(
      `https://${subdomain}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return servers;
    const dynamic = (await res.json()) as RTCIceServer[];
    if (Array.isArray(dynamic) && dynamic.length > 0) return [...servers, ...dynamic];
  } catch {
    // Network/credential error — fall back to the static set.
  }
  return servers;
}
