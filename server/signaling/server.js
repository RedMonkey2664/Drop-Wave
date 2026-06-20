/**
 * DropWave signaling server
 * =========================
 *
 * A lightweight Node + WebSocket server whose ONLY job is to relay the initial
 * WebRTC handshake (SDP offers/answers and ICE candidates) between two peers that
 * share a room code.
 *
 *   ┌──────────┐   SDP/ICE    ┌────────────┐   SDP/ICE    ┌──────────┐
 *   │ Device A │ ───────────▶ │ this server│ ◀─────────── │ Device B │
 *   └──────────┘              └────────────┘              └──────────┘
 *        │                                                      │
 *        └──────── encrypted WebRTC DataChannel (P2P) ──────────┘
 *                         FILE BYTES TRAVEL HERE ONLY
 *
 * ⚠️  IMPORTANT PRIVACY INVARIANT:
 *     This server NEVER sees file data. File bytes travel device-to-device over the
 *     encrypted WebRTC DataChannel. The server only ferries the small JSON handshake
 *     messages needed to open that channel, then it is out of the loop entirely.
 *
 * It is intentionally dependency-light (only `ws`) and stateless beyond an in-memory
 * room map, so it can be deployed to any Node host (Render, Fly, Railway, a tiny VPS).
 */

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.SIGNALING_PORT || process.env.PORT || 8080;

// Max peers per room. P2P pairing is 1:1, so 2 is the cap; the third is rejected.
const MAX_PEERS_PER_ROOM = 2;
// Drop a connection that never joins a room within this window (anti-abuse).
const JOIN_GRACE_MS = 30_000;
// Heartbeat: terminate sockets that stop responding to pings.
const HEARTBEAT_MS = 30_000;

/** @type {Map<string, Set<import('ws').WebSocket>>} roomCode -> peers */
const rooms = new Map();

// A tiny health endpoint so platforms can health-check the deploy.
const httpServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        service: "dropwave-signaling",
        status: "ok",
        rooms: rooms.size,
        note: "Handshake relay only. No file data passes through this server.",
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function peersInRoom(roomCode) {
  return rooms.get(roomCode) ?? new Set();
}

function leaveRoom(ws) {
  const { roomCode } = ws;
  if (!roomCode) return;
  const peers = rooms.get(roomCode);
  if (!peers) return;
  peers.delete(ws);
  // Tell the remaining peer their partner left so it can reset its UI.
  for (const peer of peers) send(peer, { type: "peer-left" });
  if (peers.size === 0) rooms.delete(roomCode);
  ws.roomCode = null;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;

  // Abuse guard: a socket that never joins is dropped.
  const joinTimer = setTimeout(() => {
    if (!ws.roomCode) ws.terminate();
  }, JOIN_GRACE_MS);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", reason: "bad-json" });
    }

    switch (msg.type) {
      case "join": {
        const roomCode = String(msg.room || "").trim().toUpperCase();
        if (!roomCode) return send(ws, { type: "error", reason: "no-room" });

        const peers = rooms.get(roomCode) ?? new Set();
        if (peers.size >= MAX_PEERS_PER_ROOM && !peers.has(ws)) {
          return send(ws, { type: "room-full", room: roomCode });
        }

        clearTimeout(joinTimer);
        ws.roomCode = roomCode;
        peers.add(ws);
        rooms.set(roomCode, peers);

        // The joining peer learns whether someone is already waiting. The peer that
        // arrives second is the "initiator" — it kicks off the WebRTC offer.
        const otherCount = peers.size - 1;
        send(ws, {
          type: "joined",
          room: roomCode,
          peers: otherCount,
          initiator: otherCount > 0,
        });
        // Notify the peer already in the room that a partner arrived.
        for (const peer of peers) {
          if (peer !== ws) send(peer, { type: "peer-joined" });
        }
        return;
      }

      // SDP offer/answer and ICE candidates are relayed verbatim to the OTHER peer(s)
      // in the room. The server does not parse or store them.
      case "signal": {
        if (!ws.roomCode) return send(ws, { type: "error", reason: "not-joined" });
        const peers = peersInRoom(ws.roomCode);
        for (const peer of peers) {
          if (peer !== ws) send(peer, { type: "signal", data: msg.data });
        }
        return;
      }

      case "leave":
        return leaveRoom(ws);

      default:
        return send(ws, { type: "error", reason: "unknown-type" });
    }
  });

  ws.on("close", () => {
    clearTimeout(joinTimer);
    leaveRoom(ws);
  });

  ws.on("error", () => {
    // Swallow socket errors; the close handler does cleanup.
  });
});

// Heartbeat sweep — reclaim dead sockets so rooms don't leak.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      leaveRoom(ws);
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

wss.on("close", () => clearInterval(heartbeat));

httpServer.listen(PORT, () => {
  console.log(`[dropwave-signaling] listening on :${PORT}`);
  console.log("[dropwave-signaling] handshake relay only — no file data passes here.");
});
