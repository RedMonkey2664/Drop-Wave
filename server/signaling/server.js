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
const { randomUUID } = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.SIGNALING_PORT || process.env.PORT || 8080;

// Hard cap on peers per room. Standard 1:1 sharing uses 2; "group sharing" lets the
// room's host raise this up to 4. Beyond a full mesh of 4 the N² connections get
// expensive in a browser, so 4 is the ceiling.
const HARD_MAX_PEERS = 4;
const DEFAULT_PEERS = 2;
// Drop a connection that never joins a room within this window (anti-abuse).
const JOIN_GRACE_MS = 30_000;
// Heartbeat: terminate sockets that stop responding to pings.
const HEARTBEAT_MS = 30_000;

/**
 * roomCode -> { peers: Map<peerId, ws>, capacity }. Every peer gets a stable id so the
 * server can route a handshake blob to ONE specific peer — a full mesh needs targeted
 * routing, not a broadcast. `capacity` is fixed by the first peer to join (the host).
 * @type {Map<string, { peers: Map<string, import('ws').WebSocket>, capacity: number }>}
 */
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

function leaveRoom(ws) {
  const { roomCode } = ws;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  room.peers.delete(ws.peerId);
  // Tell every remaining peer which id left so they tear down that one mesh edge.
  for (const peer of room.peers.values()) {
    send(peer, { type: "peer-left", peerId: ws.peerId });
  }
  if (room.peers.size === 0) rooms.delete(roomCode);
  ws.roomCode = null;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.peerId = randomUUID();

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

        let room = rooms.get(roomCode);
        if (!room) {
          // First joiner (the host) fixes the room capacity within [2, HARD_MAX_PEERS].
          const requested = Number(msg.maxPeers) || DEFAULT_PEERS;
          const capacity = Math.min(Math.max(requested, 2), HARD_MAX_PEERS);
          room = { peers: new Map(), capacity };
          rooms.set(roomCode, room);
        }

        if (!room.peers.has(ws.peerId) && room.peers.size >= room.capacity) {
          return send(ws, { type: "room-full", room: roomCode });
        }

        clearTimeout(joinTimer);
        ws.roomCode = roomCode;
        room.peers.set(ws.peerId, ws);

        // The joiner learns its own id + the ids already present. In the mesh, the
        // NEWCOMER is the initiator toward every existing peer; existing peers answer.
        const others = [...room.peers.keys()].filter((id) => id !== ws.peerId);
        send(ws, {
          type: "joined",
          room: roomCode,
          self: ws.peerId,
          peers: others,
          capacity: room.capacity,
        });
        // Notify everyone already in the room that a new peer (by id) arrived.
        for (const [id, peer] of room.peers) {
          if (id !== ws.peerId) send(peer, { type: "peer-joined", peerId: ws.peerId });
        }
        return;
      }

      // SDP offer/answer and ICE candidates are routed to ONE target peer (msg.to),
      // tagged with the sender's id. The server does not parse or store them.
      case "signal": {
        if (!ws.roomCode) return send(ws, { type: "error", reason: "not-joined" });
        const room = rooms.get(ws.roomCode);
        if (!room) return;
        const target = room.peers.get(msg.to);
        if (target) send(target, { type: "signal", from: ws.peerId, data: msg.data });
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
