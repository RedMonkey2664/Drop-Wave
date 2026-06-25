"use client";

/**
 * SessionProvider — orchestrator that wires signaling + a MESH of Peers + transfer into
 * a single state machine the UI consumes. It lives in the root layout so the live
 * connections survive navigation between /send, /receive and /transfer.
 *
 * Topology:
 *   • 1:1 (default) — a single WebRTC connection between two devices.
 *   • Group sharing — up to 4 devices in one room, wired as a FULL MESH: every device
 *     holds a direct, encrypted DataChannel to every other device. A file you send
 *     fans out to all connected peers; files still NEVER pass through any server.
 *
 * Mesh handshake rule (avoids "glare", where both sides offer at once): the peer that
 * joins LATER is the initiator toward everyone already in the room; existing peers
 * answer. The signaling server gives each peer a stable id and routes each SDP/ICE blob
 * to one specific peer.
 *
 * Roles ("host"/"guest") only describe who started the pairing UI; transfer is fully
 * bidirectional for every edge once open.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SignalingClient,
  getSignalingUrl,
  resolveIceServers,
} from "@/lib/signaling/client";
import { Peer, isWebRTCSupported } from "@/lib/webrtc/peer";
import {
  canStreamToDisk,
  FileReceiver,
  FileSender,
  makeSink,
  ProgressUpdate,
  ReceivedFile,
} from "@/lib/webrtc/transfer";
import { FileMeta } from "@/lib/webrtc/protocol";
import { generateRoomCode, makeId, normalizeRoomCode } from "@/lib/utils";

export type SessionPhase = "idle" | "pairing" | "connected" | "error";
export type SessionRole = "host" | "guest" | null;

export interface SessionError {
  code: "unsupported" | "room-full" | "peer-left" | "connection-failed" | "signaling";
  message: string;
}

interface SessionState {
  phase: SessionPhase;
  role: SessionRole;
  roomCode: string | null;
  /** Max devices allowed in this room (2 for 1:1, up to 4 for group sharing). */
  capacity: number;
  /** Any remote peer is known (handshaking or connected). */
  peerPresent: boolean;
  /** Count of peers with an OPEN data channel right now. */
  peerCount: number;
  channelOpen: boolean;
  connectionState: RTCPeerConnectionState | "new";
  outgoing: ProgressUpdate[];
  incoming: ProgressUpdate[];
  received: ReceivedFile[];
  error: SessionError | null;
  /** Bumped each time a peer freshly connects — lets the UI fire the splash. */
  connectNonce: number;
  /** True if this browser can stream incoming files straight to a chosen folder. */
  canSaveToDisk: boolean;
  /** Set once the receiver picks a destination folder for streamed-to-disk files. */
  saveFolderName: string | null;
  /** "Local Wi-Fi" mode: force a STUN-only, no-relay connection (LAN speed + privacy). */
  localMode: boolean;
  /**
   * The live transport class once connected (from ICE stats):
   *   "local"  — same-LAN host-to-host (fastest), "direct" — direct P2P via STUN,
   *   "relay"  — going through a TURN relay. null until known.
   */
  linkType: "local" | "direct" | "relay" | null;
}

interface SessionApi extends SessionState {
  supported: boolean;
  /**
   * Create a room. `maxPeers` 2 (1:1) or up to 4 (group sharing). `local` opts into
   * Local Wi-Fi mode (no relay). Returns the code.
   */
  host: (maxPeers?: number, opts?: { local?: boolean }) => string;
  join: (code: string, opts?: { local?: boolean }) => void;
  sendFiles: (files: File[]) => void;
  cancelOutgoing: (id?: string) => void;
  clearReceived: () => void;
  reset: () => void;
  /**
   * Ask the receiver to pick a folder; incoming files then stream straight to disk
   * (bounded memory — required for very large / many-file transfers). Resolves false if
   * unsupported or the user cancels.
   */
  chooseReceiveFolder: () => Promise<boolean>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

const initialState: SessionState = {
  phase: "idle",
  role: null,
  roomCode: null,
  capacity: 2,
  peerPresent: false,
  peerCount: 0,
  channelOpen: false,
  connectionState: "new",
  outgoing: [],
  incoming: [],
  received: [],
  error: null,
  connectNonce: 0,
  canSaveToDisk: false,
  saveFolderName: null,
  localMode: false,
  linkType: null,
};

/** One outgoing file we've chosen to share this session (id is stable across peers). */
interface OutgoingItem {
  file: File;
  meta: FileMeta;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);

  // ── engine refs (mutating these must not trigger re-renders) ──────────────────
  const signalingRef = useRef<SignalingClient | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const capacityRef = useRef(2);
  // Local Wi-Fi mode for the current session (STUN-only, no TURN relay).
  const localModeRef = useRef(false);
  // Resolved once per session (STUN + optional TURN) and shared by every mesh edge.
  const iceServersRef = useRef<RTCIceServer[] | undefined>(undefined);
  // Bumped on every start/teardown to cancel a superseded async ICE resolution.
  const startTokenRef = useRef(0);
  // Receiver "stream to disk" destination (File System Access dir handle) + name dedupe.
  const dirHandleRef = useRef<any | null>(null);
  const usedNamesRef = useRef<Set<string>>(new Set());

  // Mesh: one Peer (+ sender/receiver/send-chain) per remote peer id.
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const sendersRef = useRef<Map<string, FileSender>>(new Map());
  const receiversRef = useRef<Map<string, FileReceiver>>(new Map());
  const sendChainRef = useRef<Map<string, Promise<void>>>(new Map());
  const openChannelsRef = useRef<Set<string>>(new Set());

  // Every file chosen to share this session, plus which peers already received each.
  const outgoingQueueRef = useRef<OutgoingItem[]>([]);
  const deliveredRef = useRef<Map<string, Set<string>>>(new Map()); // peerId -> metaIds
  // Aggregation of per-peer outgoing progress into one row per file id.
  const outAggRef = useRef<Map<string, Map<string, ProgressUpdate>>>(new Map());
  const outTargetsRef = useRef<Map<string, Set<string>>>(new Map()); // metaId -> peerIds
  const supportedRef = useRef(true);

  // Keep a ref mirror of state for use inside stable callbacks.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const mergeIncoming = useCallback((u: ProgressUpdate) => {
    setState((s) => ({ ...s, incoming: upsert(s.incoming, u) }));
  }, []);

  // Give each disk-streamed file a unique, filesystem-safe name within the chosen folder
  // so 100 files (some sharing a name) never overwrite each other.
  const uniqueName = useCallback((name: string): string => {
    const used = usedNamesRef.current;
    const safe = sanitizeFileName(name);
    if (!used.has(safe)) {
      used.add(safe);
      return safe;
    }
    const dot = safe.lastIndexOf(".");
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : "";
    let i = 1;
    while (used.has(`${base} (${i})${ext}`)) i++;
    const final = `${base} (${i})${ext}`;
    used.add(final);
    return final;
  }, []);

  // ── outgoing aggregation: combine every peer's progress for a file into one row ──
  const recomputeOutgoing = useCallback((metaId: string) => {
    const perPeer = outAggRef.current.get(metaId);
    if (!perPeer || perPeer.size === 0) return;
    const targets = outTargetsRef.current.get(metaId) ?? new Set(perPeer.keys());
    const n = Math.max(targets.size, perPeer.size, 1);
    const any = perPeer.values().next().value as ProgressUpdate;

    let transferred = 0;
    let speed = 0;
    let done = 0;
    let canceled = 0;
    let errored = 0;
    for (const pu of perPeer.values()) {
      transferred += pu.transferred;
      speed += pu.speed;
      if (pu.status === "done") done++;
      else if (pu.status === "canceled") canceled++;
      else if (pu.status === "error") errored++;
    }
    const size = any.size;
    const progress = size > 0 ? Math.min(transferred / (size * n), 1) : done >= n ? 1 : 0;
    let status: ProgressUpdate["status"] = "active";
    if (done >= n) status = "done";
    else if (canceled >= n) status = "canceled";
    else if (errored > 0 && done + canceled + errored >= n) status = "error";

    const row: ProgressUpdate = {
      id: metaId,
      name: any.name,
      size,
      type: any.type,
      transferred: Math.round(transferred / n),
      progress,
      speed, // combined throughput across recipients
      status,
    };
    setState((s) => ({ ...s, outgoing: upsert(s.outgoing, row) }));
  }, []);

  const mergeOutgoing = useCallback(
    (peerId: string, u: ProgressUpdate) => {
      let perPeer = outAggRef.current.get(u.id);
      if (!perPeer) {
        perPeer = new Map();
        outAggRef.current.set(u.id, perPeer);
      }
      perPeer.set(peerId, u);
      recomputeOutgoing(u.id);
    },
    [recomputeOutgoing]
  );

  // ── fan-out delivery ──────────────────────────────────────────────────────────
  const deliverToPeer = useCallback(
    (peerId: string, items: OutgoingItem[]) => {
      const channel = peersRef.current.get(peerId)?.dataChannel;
      if (!channel || channel.readyState !== "open") return;

      let delivered = deliveredRef.current.get(peerId);
      if (!delivered) {
        delivered = new Set();
        deliveredRef.current.set(peerId, delivered);
      }
      const fresh = items.filter((it) => !delivered!.has(it.meta.id));
      if (fresh.length === 0) return;
      for (const it of fresh) {
        delivered.add(it.meta.id);
        let t = outTargetsRef.current.get(it.meta.id);
        if (!t) {
          t = new Set();
          outTargetsRef.current.set(it.meta.id, t);
        }
        t.add(peerId);
      }

      let sender = sendersRef.current.get(peerId);
      if (!sender) {
        const maxMsg = peersRef.current.get(peerId)?.maxMessageSize ?? 0;
        sender = new FileSender(channel, (u) => mergeOutgoing(peerId, u), maxMsg);
        sendersRef.current.set(peerId, sender);
      }
      // Serialize all sends to this peer — concurrent sendFiles() on one channel would
      // interleave binary chunks and corrupt reassembly.
      const prev = sendChainRef.current.get(peerId) ?? Promise.resolve();
      const next = prev
        .then(() =>
          sender!.sendFiles(
            fresh.map((i) => i.file),
            fresh.map((i) => i.meta)
          )
        )
        .catch(() => {});
      sendChainRef.current.set(peerId, next);
    },
    [mergeOutgoing]
  );

  // Poll a freshly-connected peer's ICE stats until the selected candidate pair is known,
  // then surface whether the live path is local / direct / relayed (drives the badge).
  const probeLinkType = useCallback((peerId: string) => {
    let tries = 0;
    const tick = async () => {
      const peer = peersRef.current.get(peerId);
      if (!peer || !openChannelsRef.current.has(peerId)) return;
      const t = await peer.getLinkType();
      if (t) {
        setState((s) => ({ ...s, linkType: t }));
        return;
      }
      if (++tries < 12) setTimeout(tick, 600);
    };
    void tick();
  }, []);

  // ── derived state recompute (peer counts / phase) ─────────────────────────────
  const syncPeerState = useCallback(() => {
    const known = peersRef.current.size;
    const open = openChannelsRef.current.size;
    setState((s) => ({
      ...s,
      peerPresent: known > 0,
      peerCount: open,
      channelOpen: open > 0,
      connectionState: open > 0 ? "connected" : s.connectionState,
      phase: open > 0 ? "connected" : s.phase === "connected" ? "pairing" : s.phase,
    }));
  }, []);

  // ── teardown ──────────────────────────────────────────────────────────────────
  const destroyPeer = useCallback((peerId: string) => {
    peersRef.current.get(peerId)?.destroy();
    peersRef.current.delete(peerId);
    sendersRef.current.delete(peerId);
    receiversRef.current.delete(peerId);
    sendChainRef.current.delete(peerId);
    deliveredRef.current.delete(peerId);
    openChannelsRef.current.delete(peerId);
    // Drop this peer from every file's outgoing aggregation.
    for (const [metaId, perPeer] of outAggRef.current) {
      perPeer.delete(peerId);
      outTargetsRef.current.get(metaId)?.delete(peerId);
    }
  }, []);

  const teardown = useCallback(() => {
    // Invalidate any in-flight ICE resolution so its .then() can't revive a dead session.
    startTokenRef.current++;
    for (const id of [...peersRef.current.keys()]) destroyPeer(id);
    signalingRef.current?.close();
    signalingRef.current = null;
    selfIdRef.current = null;
    iceServersRef.current = undefined;
    localModeRef.current = false;
    outgoingQueueRef.current = [];
    outAggRef.current.clear();
    outTargetsRef.current.clear();
  }, [destroyPeer]);

  const reset = useCallback(() => {
    teardown();
    dirHandleRef.current = null;
    usedNamesRef.current = new Set();
    setState((s) => {
      s.received.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      return { ...initialState, canSaveToDisk: canStreamToDisk() };
    });
  }, [teardown]);

  // ── peer creation (one per mesh edge) ─────────────────────────────────────────
  const createPeer = useCallback(
    (remoteId: string, initiator: boolean): Peer | null => {
      const signaling = signalingRef.current;
      if (!signaling) return null;
      // Already have an edge to this peer.
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const peer = new Peer({
        initiator,
        iceServers: iceServersRef.current,
        sendSignal: (payload) => signaling.signal(remoteId, payload),
        events: {
          onConnectionStateChange: (cs) => {
            // Surface a hard failure only if NO edge is up (group: others may be fine).
            if (cs === "failed" && openChannelsRef.current.size === 0) {
              setState((s) => ({
                ...s,
                phase: "error",
                error: {
                  code: "connection-failed",
                  message: localModeRef.current
                    ? "Local Wi-Fi mode couldn't find a direct path — the devices may be on different networks. Turn off Local Wi-Fi to allow an internet relay, then re-pair."
                    : "Could not establish a direct connection. Try the same Wi-Fi, or re-pair.",
                },
              }));
            }
          },
          onChannelOpen: (channel) => {
            const receiver = new FileReceiver(
              {
                onProgress: mergeIncoming,
                onFileComplete: (file) =>
                  setState((s) => ({ ...s, received: [...s.received, file] })),
              },
              (data) => {
                if (channel.readyState === "open") channel.send(data);
              },
              // Stream to the chosen folder when set (read live at each file-start), else
              // fall back to an in-memory Blob.
              (meta) => makeSink(meta, dirHandleRef.current, uniqueName)
            );
            receiversRef.current.set(remoteId, receiver);
            openChannelsRef.current.add(remoteId);
            setState((s) => ({ ...s, error: null, connectNonce: s.connectNonce + 1 }));
            syncPeerState();
            // Detect the live transport (local / direct / relay) for the speed badge.
            probeLinkType(remoteId);
            // Deliver everything shared so far to this newly-open peer.
            deliverToPeer(remoteId, outgoingQueueRef.current);
          },
          onChannelClose: () => {
            openChannelsRef.current.delete(remoteId);
            syncPeerState();
          },
          onMessage: (data) => receiversRef.current.get(remoteId)?.handleMessage(data),
          onError: (err) => console.warn("[dropwave] peer error", remoteId, err),
        },
      });
      peersRef.current.set(remoteId, peer);
      syncPeerState();
      if (initiator) void peer.start();
      return peer;
    },
    [deliverToPeer, mergeIncoming, probeLinkType, syncPeerState, uniqueName]
  );

  // ── signaling wiring ──────────────────────────────────────────────────────────
  const startSignaling = useCallback(
    (
      room: string,
      role: Exclude<SessionRole, null>,
      maxPeers: number,
      localOnly: boolean
    ) => {
      if (!isWebRTCSupported()) {
        supportedRef.current = false;
        setState((s) => ({
          ...s,
          phase: "error",
          error: {
            code: "unsupported",
            message:
              "This browser doesn't support WebRTC data channels. Try the latest Chrome, Edge, Safari, or Firefox.",
          },
        }));
        return;
      }

      teardown();
      const token = ++startTokenRef.current;
      capacityRef.current = maxPeers;
      localModeRef.current = localOnly;

      // Show the room/QR immediately; the connection waits on ICE resolution (fast).
      setState((s) => ({
        ...s,
        phase: "pairing",
        role,
        roomCode: room,
        capacity: maxPeers,
        localMode: localOnly,
        linkType: null,
        error: null,
      }));

      void resolveIceServers({ localOnly }).then((servers) => {
        // A reset/new session happened during the fetch — abandon this one.
        if (startTokenRef.current !== token) return;
        iceServersRef.current = servers;

        const signaling = new SignalingClient({ url: getSignalingUrl() });
        signalingRef.current = signaling;

        signaling.on((ev) => {
        switch (ev.type) {
          case "open":
            signaling.join(room, capacityRef.current);
            break;
          case "joined": {
            selfIdRef.current = ev.self;
            setState((s) => ({ ...s, capacity: ev.capacity }));
            // I'm the newcomer → initiate toward everyone already here.
            for (const id of ev.peers) createPeer(id, true);
            syncPeerState();
            break;
          }
          case "peer-joined":
            // A new peer arrived after me → I answer (they initiate).
            createPeer(ev.peerId, false);
            break;
          case "signal": {
            // Lazily stand up an answering edge if we don't have one yet.
            let peer = peersRef.current.get(ev.from);
            if (!peer) peer = createPeer(ev.from, false) ?? undefined;
            void peer?.receiveSignal(ev.data as any);
            break;
          }
          case "peer-left":
            destroyPeer(ev.peerId);
            syncPeerState();
            break;
          case "room-full":
            setState((s) => ({
              ...s,
              phase: "error",
              error: {
                code: "room-full",
                message:
                  capacityRef.current > 2
                    ? `This group is full (${capacityRef.current} devices). Start a new share.`
                    : "That room already has two devices. Start a new share.",
              },
            }));
            break;
          case "error":
            break;
        }
        });

        signaling.connect();
      });
    },
    [createPeer, destroyPeer, syncPeerState, teardown]
  );

  const host = useCallback(
    (maxPeers = 2, opts?: { local?: boolean }): string => {
      const code = generateRoomCode();
      startSignaling(code, "host", Math.min(Math.max(maxPeers, 2), 4), !!opts?.local);
      return code;
    },
    [startSignaling]
  );

  const join = useCallback(
    (code: string, opts?: { local?: boolean }) => {
      const normalized = normalizeRoomCode(code);
      if (!normalized) return;
      // Guests don't set capacity; the host's value wins server-side.
      startSignaling(normalized, "guest", 4, !!opts?.local);
    },
    [startSignaling]
  );

  const sendFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const items: OutgoingItem[] = files.map((file) => ({
        file,
        meta: {
          id: makeId(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        },
      }));
      // Remember for late-joining peers, and deliver to everyone connected now.
      outgoingQueueRef.current = [...outgoingQueueRef.current, ...items];
      for (const peerId of openChannelsRef.current) deliverToPeer(peerId, items);
    },
    [deliverToPeer]
  );

  const cancelOutgoing = useCallback((id?: string) => {
    for (const sender of sendersRef.current.values()) sender.cancel(id);
  }, []);

  const clearReceived = useCallback(() => {
    setState((s) => {
      s.received.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      return { ...s, received: [], incoming: [] };
    });
  }, []);

  const chooseReceiveFolder = useCallback(async (): Promise<boolean> => {
    const picker = (window as any).showDirectoryPicker;
    if (typeof picker !== "function") return false;
    try {
      const handle = await picker({ mode: "readwrite" });
      dirHandleRef.current = handle;
      usedNamesRef.current = new Set();
      setState((s) => ({ ...s, saveFolderName: handle.name ?? "selected folder" }));
      return true;
    } catch {
      // User dismissed the picker, or permission denied — keep the in-memory path.
      return false;
    }
  }, []);

  useEffect(() => {
    supportedRef.current = isWebRTCSupported();
    setState((s) => ({ ...s, canSaveToDisk: canStreamToDisk() }));
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const api = useMemo<SessionApi>(
    () => ({
      ...state,
      supported: supportedRef.current,
      host,
      join,
      sendFiles,
      cancelOutgoing,
      clearReceived,
      reset,
      chooseReceiveFolder,
    }),
    [state, host, join, sendFiles, cancelOutgoing, clearReceived, reset, chooseReceiveFolder]
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

/** Strip path separators / illegal characters so a peer-supplied name is safe on disk. */
function sanitizeFileName(name: string): string {
  const base = (name || "file").split(/[\\/]/).pop() || "file";
  // Replace characters invalid on Windows/macOS filesystems (keep spaces/hyphens/dots).
  const cleaned = base
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 200) || "file";
}

/** Upsert a progress row by id, preserving insertion order. */
function upsert(list: ProgressUpdate[], u: ProgressUpdate): ProgressUpdate[] {
  const idx = list.findIndex((x) => x.id === u.id);
  if (idx === -1) return [...list, u];
  const next = list.slice();
  next[idx] = u;
  return next;
}
