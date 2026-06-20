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

## Deploy to Fly.io

A `Dockerfile` and `fly.toml` are included in this directory.

```bash
# one-time: install the CLI and sign in
#   Windows (PowerShell):  iwr https://fly.io/install.ps1 -useb | iex
#   macOS/Linux:           curl -L https://fly.io/install.sh | sh
fly auth signup        # or: fly auth login

cd server/signaling
fly launch --no-deploy  # confirm app name + region (uses the bundled fly.toml)
fly deploy
```

Your endpoint will be `https://<app>.fly.dev`, and the WebSocket the app connects to is
`wss://<app>.fly.dev`. Verify it's up: open `https://<app>.fly.dev/health` — you should
see `{"service":"dropwave-signaling","status":"ok",...}`.

> `app` in `fly.toml` must be globally unique on Fly. If `dropwave-signaling` is taken,
> change it (or let `fly launch` pick a name); your `wss://` URL changes to match.

### Point the web app at it

In your **Vercel** project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SIGNALING_URL = wss://<app>.fly.dev
```

then redeploy. (Locally, set the same in `.env.local`.)

## Deploy notes (any host)

1. **Serve over TLS (`wss://`)** in production — browsers require secure origins for
   WebRTC/camera on non-localhost. Fly does TLS automatically.
2. Set the app's `NEXT_PUBLIC_SIGNALING_URL` to your `wss://…` URL.
3. For users on **different networks**, also configure a TURN relay via the app's
   `NEXT_PUBLIC_TURN_URLS` / `…_USERNAME` / `…_CREDENTIAL` env vars (see `.env.example`).

A `GET /health` endpoint is provided for platform health checks.
