"use client";

/**
 * SessionProvider — the orchestrator that wires signaling + Peer + transfer into a
 * single state machine the UI can consume. It lives in the root layout so the live
 * WebRTC connection survives navigation between /send, /receive and /transfer (the
 * App Router keeps a layout-level provider mounted across route changes).
 *
 * Roles:
 *   • "host"  — created the room (the sender in the canonical flow). Joins first, so
 *               it is the WebRTC answerer.
 *   • "guest" — scanned/typed the code. Joins second, so it is the WebRTC initiator.
 *
 * Transfer is fully bidirectional once the channel is open: either device can send
 * files without re-pairing. Role only describes who started the pairing UI.
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
import { SignalingClient, getSignalingUrl } from "@/lib/signaling/client";
import { Peer, isWebRTCSupported } from "@/lib/webrtc/peer";
import {
  FileReceiver,
  FileSender,
  ProgressUpdate,
  ReceivedFile,
} from "@/lib/webrtc/transfer";
import { generateRoomCode, normalizeRoomCode } from "@/lib/utils";

export type SessionPhase =
  | "idle"
  | "pairing" // room created/joined, waiting for / negotiating with peer
  | "connected"
  | "error";

export type SessionRole = "host" | "guest" | null;

export interface SessionError {
  code: "unsupported" | "room-full" | "peer-left" | "connection-failed" | "signaling";
  message: string;
}

interface SessionState {
  phase: SessionPhase;
  role: SessionRole;
  roomCode: string | null;
  peerPresent: boolean;
  channelOpen: boolean;
  connectionState: RTCPeerConnectionState | "new";
  outgoing: ProgressUpdate[];
  incoming: ProgressUpdate[];
  received: ReceivedFile[];
  error: SessionError | null;
  /** Bumped each time we freshly connect — lets the UI fire the splash once. */
  connectNonce: number;
}

interface SessionApi extends SessionState {
  supported: boolean;
  host: () => string;
  join: (code: string) => void;
  sendFiles: (files: File[]) => void;
  cancelOutgoing: (id?: string) => void;
  clearReceived: () => void;
  reset: () => void;
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
  peerPresent: false,
  channelOpen: false,
  connectionState: "new",
  outgoing: [],
  incoming: [],
  received: [],
  error: null,
  connectNonce: 0,
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);

  // Mutable engine refs — these must not trigger re-renders on every mutation.
  const signalingRef = useRef<SignalingClient | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const senderRef = useRef<FileSender | null>(null);
  const receiverRef = useRef<FileReceiver | null>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const amInitiatorRef = useRef(false);
  const peerStartedRef = useRef(false);
  const supportedRef = useRef(true);

  // ── progress merge helpers (functional updates, no stale closures) ──────────
  const mergeOutgoing = useCallback((u: ProgressUpdate) => {
    setState((s) => ({ ...s, outgoing: upsert(s.outgoing, u) }));
  }, []);
  const mergeIncoming = useCallback((u: ProgressUpdate) => {
    setState((s) => ({ ...s, incoming: upsert(s.incoming, u) }));
  }, []);

  // ── teardown ────────────────────────────────────────────────────────────────
  const teardown = useCallback(() => {
    peerRef.current?.destroy();
    peerRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
    senderRef.current = null;
    receiverRef.current = null;
    pendingFilesRef.current = [];
    peerStartedRef.current = false;
  }, []);

  const reset = useCallback(() => {
    teardown();
    // Revoke object URLs to free memory.
    setState((s) => {
      s.received.forEach((f) => URL.revokeObjectURL(f.url));
      return { ...initialState };
    });
  }, [teardown]);

  // ── peer lifecycle ───────────────────────────────────────────────────────────
  const trySendPending = useCallback(() => {
    const channel = peerRef.current?.dataChannel;
    if (!channel || channel.readyState !== "open") return;
    if (pendingFilesRef.current.length === 0) return;
    const files = pendingFilesRef.current;
    pendingFilesRef.current = [];
    const sender = new FileSender(channel, mergeOutgoing);
    senderRef.current = sender;
    void sender.sendFiles(files);
  }, [mergeOutgoing]);

  const createPeer = useCallback(
    (initiator: boolean) => {
      peerStartedRef.current = false;
      const signaling = signalingRef.current;
      if (!signaling) return;

      const peer = new Peer({
        initiator,
        sendSignal: (payload) => signaling.signal(payload),
        events: {
          onConnectionStateChange: (cs) => {
            setState((s) => ({ ...s, connectionState: cs }));
            if (cs === "failed") {
              setState((s) => ({
                ...s,
                phase: "error",
                error: {
                  code: "connection-failed",
                  message:
                    "Could not establish a direct connection. Try the same Wi-Fi, or re-pair.",
                },
              }));
            }
          },
          onChannelOpen: (channel) => {
            // Always stand up a receiver so incoming files are handled both ways.
            const receiver = new FileReceiver(
              {
                onProgress: mergeIncoming,
                onFileComplete: (file) =>
                  setState((s) => ({ ...s, received: [...s.received, file] })),
              },
              (data) => {
                if (channel.readyState === "open") channel.send(data);
              }
            );
            receiverRef.current = receiver;
            setState((s) => ({
              ...s,
              channelOpen: true,
              phase: "connected",
              error: null,
              connectNonce: s.connectNonce + 1,
            }));
            trySendPending();
          },
          onChannelClose: () => {
            setState((s) => ({ ...s, channelOpen: false }));
          },
          onMessage: (data) => receiverRef.current?.handleMessage(data),
          onError: (err) => {
            // Non-fatal channel errors are logged; connection-state handles fatal ones.
            console.warn("[dropwave] peer error", err);
          },
        },
      });
      peerRef.current = peer;
    },
    [mergeIncoming, trySendPending]
  );

  const maybeStart = useCallback(() => {
    if (
      amInitiatorRef.current &&
      !peerStartedRef.current &&
      peerRef.current &&
      stateRef.current.peerPresent
    ) {
      peerStartedRef.current = true;
      void peerRef.current.start();
    }
  }, []);

  // Keep a ref mirror of state for use inside stable callbacks.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── signaling wiring ──────────────────────────────────────────────────────────
  const startSignaling = useCallback(
    (room: string, role: Exclude<SessionRole, null>) => {
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
      const signaling = new SignalingClient({ url: getSignalingUrl() });
      signalingRef.current = signaling;

      signaling.on((ev) => {
        switch (ev.type) {
          case "open":
            signaling.join(room);
            break;
          case "joined":
            amInitiatorRef.current = ev.initiator;
            setState((s) => ({ ...s, peerPresent: ev.peers > 0 }));
            createPeer(ev.initiator);
            maybeStart();
            break;
          case "peer-joined":
            setState((s) => ({ ...s, peerPresent: true }));
            maybeStart();
            break;
          case "peer-left":
            // Partner dropped — reset for a fresh handshake, keep the room open.
            peerRef.current?.destroy();
            peerRef.current = null;
            peerStartedRef.current = false;
            setState((s) => ({
              ...s,
              peerPresent: false,
              channelOpen: false,
              phase: "pairing",
              connectionState: "new",
            }));
            createPeer(amInitiatorRef.current);
            break;
          case "signal":
            void peerRef.current?.receiveSignal(ev.data as any);
            break;
          case "room-full":
            setState((s) => ({
              ...s,
              phase: "error",
              error: {
                code: "room-full",
                message: "That room already has two devices. Start a new share.",
              },
            }));
            break;
          case "error":
            // Transient signaling hiccups auto-reconnect; only surface if we never paired.
            break;
        }
      });

      setState((s) => ({
        ...s,
        phase: "pairing",
        role,
        roomCode: room,
        error: null,
      }));
      signaling.connect();
    },
    [createPeer, maybeStart, teardown]
  );

  const host = useCallback((): string => {
    const code = generateRoomCode();
    startSignaling(code, "host");
    return code;
  }, [startSignaling]);

  const join = useCallback(
    (code: string) => {
      const normalized = normalizeRoomCode(code);
      if (!normalized) return;
      startSignaling(normalized, "guest");
    },
    [startSignaling]
  );

  const sendFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const channel = peerRef.current?.dataChannel;
      if (channel && channel.readyState === "open") {
        const sender = senderRef.current ?? new FileSender(channel, mergeOutgoing);
        senderRef.current = sender;
        void sender.sendFiles(files);
      } else {
        // Queue until the channel opens (canonical flow: pick files, then pair).
        pendingFilesRef.current = [...pendingFilesRef.current, ...files];
      }
    },
    [mergeOutgoing]
  );

  const cancelOutgoing = useCallback((id?: string) => {
    senderRef.current?.cancel(id);
  }, []);

  const clearReceived = useCallback(() => {
    setState((s) => {
      s.received.forEach((f) => URL.revokeObjectURL(f.url));
      return { ...s, received: [], incoming: [] };
    });
  }, []);

  // Detect unsupported browser up front for the UI.
  useEffect(() => {
    supportedRef.current = isWebRTCSupported();
  }, []);

  // Clean up on unmount.
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
    }),
    [state, host, join, sendFiles, cancelOutgoing, clearReceived, reset]
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

/** Upsert a progress row by id, preserving insertion order. */
function upsert(list: ProgressUpdate[], u: ProgressUpdate): ProgressUpdate[] {
  const idx = list.findIndex((x) => x.id === u.id);
  if (idx === -1) return [...list, u];
  const next = list.slice();
  next[idx] = u;
  return next;
}
