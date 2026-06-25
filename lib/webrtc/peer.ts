/**
 * peer.ts — a thin, opinionated wrapper around the native RTCPeerConnection.
 *
 * Responsibilities:
 *   • Negotiate one reliable, ordered DataChannel between two peers.
 *   • Drive SDP offer/answer + ICE through an injected `signal` transport (the
 *     SignalingClient). This wrapper is transport-agnostic so it stays testable.
 *   • Surface a tiny event API: connection-state, channel-open, message, error.
 *
 * The DataChannel is where ALL file bytes flow — encrypted by default (DTLS-SRTP).
 * The signaling server only ever sees the SDP/ICE handshake blobs relayed below.
 *
 * iOS Safari WebRTC quirks handled here (commented inline):
 *   (a) The offerer MUST create the DataChannel *before* createOffer(), or Safari
 *       negotiates a connection with no channel.
 *   (b) Remote ICE candidates can arrive before setRemoteDescription resolves; we
 *       queue them and flush once the remote description is in place.
 *   (c) binaryType must be "arraybuffer" — Safari defaults to "blob" which breaks
 *       our chunk-reassembly fast path.
 */

import { getIceServers } from "@/lib/signaling/client";

/** Handshake payloads we relay through signaling. */
type SignalPayload =
  | { kind: "sdp"; description: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

export interface PeerEvents {
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onChannelOpen?: (channel: RTCDataChannel) => void;
  onChannelClose?: () => void;
  onMessage?: (data: string | ArrayBuffer) => void;
  onError?: (err: unknown) => void;
}

export class Peer {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private readonly isInitiator: boolean;
  private readonly sendSignal: (payload: SignalPayload) => void;
  private events: PeerEvents;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private destroyed = false;

  constructor(opts: {
    initiator: boolean;
    sendSignal: (payload: SignalPayload) => void;
    events?: PeerEvents;
    /** Pre-resolved ICE servers (STUN + optional TURN). Falls back to STUN defaults. */
    iceServers?: RTCIceServer[];
  }) {
    this.isInitiator = opts.initiator;
    this.sendSignal = opts.sendSignal;
    this.events = opts.events ?? {};

    this.pc = new RTCPeerConnection({ iceServers: opts.iceServers ?? getIceServers() });

    this.pc.onicecandidate = (ev) => {
      // A null candidate signals end-of-candidates; nothing to relay.
      if (ev.candidate) {
        this.sendSignal({ kind: "ice", candidate: ev.candidate.toJSON() });
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange?.(this.pc.connectionState);
    };

    // Quirk (a): only the initiator creates the channel; the answerer receives it.
    if (this.isInitiator) {
      const channel = this.pc.createDataChannel("dropwave", { ordered: true });
      this.bindChannel(channel);
    } else {
      this.pc.ondatachannel = (ev) => this.bindChannel(ev.channel);
    }
  }

  private bindChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer"; // Quirk (c)
    channel.onopen = () => this.events.onChannelOpen?.(channel);
    channel.onclose = () => this.events.onChannelClose?.();
    channel.onerror = (ev) => this.events.onError?.(ev);
    channel.onmessage = (ev) => this.events.onMessage?.(ev.data);
  }

  /** Kick off negotiation. Only the initiator calls this (after channel creation). */
  async start() {
    if (!this.isInitiator) return;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.sendSignal({ kind: "sdp", description: offer });
    } catch (err) {
      this.events.onError?.(err);
    }
  }

  /** Handle an inbound handshake payload relayed from the other peer. */
  async receiveSignal(payload: SignalPayload) {
    if (this.destroyed) return;
    try {
      if (payload.kind === "sdp") {
        await this.pc.setRemoteDescription(payload.description);
        this.remoteDescriptionSet = true;
        await this.flushCandidates();

        // If we received an offer, we are the answerer: reply with an answer.
        if (payload.description.type === "offer") {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.sendSignal({ kind: "sdp", description: answer });
        }
      } else if (payload.kind === "ice") {
        // Quirk (b): queue ICE until the remote description exists.
        if (this.remoteDescriptionSet) {
          await this.pc.addIceCandidate(payload.candidate);
        } else {
          this.pendingCandidates.push(payload.candidate);
        }
      }
    } catch (err) {
      this.events.onError?.(err);
    }
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of queued) {
      try {
        await this.pc.addIceCandidate(c);
      } catch (err) {
        this.events.onError?.(err);
      }
    }
  }

  get dataChannel(): RTCDataChannel | null {
    return this.channel;
  }

  /**
   * The SCTP transport's max single-message size, once negotiated. The sender uses this
   * to pick the largest safe chunk size (bigger = far less overhead for huge transfers).
   * Returns 0 until the connection is up.
   */
  get maxMessageSize(): number {
    return (this.pc as any).sctp?.maxMessageSize ?? 0;
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  destroy() {
    this.destroyed = true;
    try {
      this.channel?.close();
    } catch {}
    try {
      this.pc.close();
    } catch {}
    this.channel = null;
  }
}

/** Feature-detect WebRTC + DataChannel support for the unsupported-browser path. */
export function isWebRTCSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof RTCPeerConnection !== "undefined" &&
    typeof RTCPeerConnection.prototype.createDataChannel === "function"
  );
}
