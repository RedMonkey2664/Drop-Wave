# DropWave Signaling Server

A tiny Node + WebSocket relay for the **initial WebRTC handshake only**.

> **It never sees file data.** Once two peers exchange their SDP/ICE through this
> server, they open an encrypted WebRTC DataChannel and the file bytes travel directly
> device-to-device. This server is out of the loop for the actual transfer.

## Run locally

```bash
cd server/signaling
npm install
npm start          # listens on :8080 (override with SIGNALING_PORT)
```

Point the web app at it via `NEXT_PUBLIC_SIGNALING_URL=ws://localhost:8080`.

## Protocol

Messages are JSON over a single WebSocket.

| Client → Server         | Meaning                                            |
|-------------------------|----------------------------------------------------|
| `{type:"join", room}`   | Join/create a room by code.                        |
| `{type:"signal", data}` | Relay SDP/ICE blob to the other peer in the room.  |
| `{type:"leave"}`        | Leave the room.                                    |

| Server → Client                          | Meaning                                  |
|------------------------------------------|------------------------------------------|
| `{type:"joined", peers, initiator}`      | Joined OK; `initiator` starts the offer. |
| `{type:"peer-joined"}`                   | The other device arrived.                |
| `{type:"peer-left"}`                     | The other device disconnected.           |
| `{type:"signal", data}`                  | Relayed handshake blob from the peer.    |
| `{type:"room-full"}` / `{type:"error"}`  | Rejections.                              |

## Deploy

Any Node host works (Render, Railway, Fly.io, a small VPS). Two requirements:

1. **Serve over TLS (`wss://`)** in production — browsers require secure origins for
   WebRTC/camera on non-localhost.
2. Set the app's `NEXT_PUBLIC_SIGNALING_URL` to your `wss://…` URL.

A `GET /health` endpoint is provided for platform health checks.
