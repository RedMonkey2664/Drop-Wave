# CLAUDE.md — DropWave Project Bible

> The single source of truth for Claude Code when working on this project.
> Read this file fully before generating or editing any code.

---

## 1. What we are building

**DropWave** is a production-grade, cross-platform peer-to-peer file-sharing **PWA**.
It runs identically in the browser on **iOS, Android, Windows, and macOS** with **zero
installs and zero accounts**.

**Tagline:** "Drop a file. It lands anywhere."

**The problem it solves:** Sharing files between an iPhone and a Windows PC is painful.
AirDrop doesn't reach Windows; cloud/email is slow and requires accounts; cables are
clunky. DropWave makes device-to-device transfer instant, private, and universal.

> ⚠️ **Naming:** "DropWave" is a placeholder. Do NOT use "Dropbox" — it is an existing
> company and creates brand/legal conflict. Keep the name in one config constant so it
> can be swapped everywhere at once.

---

## 2. Non-negotiable architecture

This is the most important section. Do not deviate without flagging it.

### Transfer = true P2P over WebRTC
- File bytes travel **device-to-device over WebRTC DataChannels** and **NEVER touch any
  server**.
- Large files MUST be **chunked**; support **multiple files** per session.
- WebRTC DataChannels are **encrypted by default** — surface this to the user as a trust
  signal, do not claim more than is true.

### Signaling = handshake only
- A **lightweight Node + WebSocket signaling server** exists ONLY to exchange the initial
  WebRTC SDP/ICE handshake.
- The signaling server **never sees file data**. Make this explicit in code comments and
  in the README.

### Pairing UX
- **Primary:** Device A generates a **QR code**; Device B **scans it** (camera) to connect.
- **Fallback:** short, human-readable **room code** (for when camera is denied/unavailable).

### Connectivity
- Use **STUN** for ICE. On the same Wi-Fi the connection stays **local/offline**.
- Handle the case where no internet is available gracefully.

### Honesty rule (write this into the product copy AND comments)
QR-scan-to-pair is the unavoidable cost of "no install, runs everywhere." It is NOT
zero-tap like AirDrop, but it is the smoothest version that genuinely works iOS↔Windows
in a browser. Never imply the app does raw LAN auto-discovery — browsers cannot do that.

---

## 3. Tech stack (do not substitute without asking)

| Concern        | Choice                                             |
|----------------|----------------------------------------------------|
| Framework      | Next.js (App Router) + TypeScript                  |
| Styling        | Tailwind CSS                                        |
| Animation      | Framer Motion (see ANIMATION.md)                    |
| P2P            | simple-peer or native RTCPeerConnection             |
| QR             | generator + camera-based scanner components         |
| PWA            | manifest + service worker + offline app shell       |
| Signaling      | separate small Node/ws server                       |

---

## 4. Project structure (target)

```
dropwave/
├── app/                      # Next.js App Router routes
│   ├── page.tsx              # Landing (Send / Receive)
│   ├── send/                 # Sender flow
│   ├── receive/              # Receiver flow
│   └── transfer/             # Live transfer screen
├── components/
│   ├── ui/                   # Reusable primitives (Button, Card, Badge…)
│   ├── motion/               # Reusable animated components (Ripple, Radar, Splash…)
│   ├── pairing/              # QR generate + scan, room code
│   └── transfer/             # Progress, file list, success states
├── lib/
│   ├── webrtc/               # Peer connection, chunking, transfer protocol
│   ├── signaling/            # WS client
│   └── theme/                # tokens.ts — colors, motion durations, easing
├── server/
│   └── signaling/            # Node + ws signaling server (standalone, deployable)
├── public/                   # manifest, icons, service worker
├── CLAUDE.md
├── DESIGN.md
├── ANIMATION.md
└── README.md
```

---

## 5. UX flow (the canonical happy path)

1. **Landing** — bold hero; one tap "Send" or "Receive."
2. **Sender** — pick files (drag-drop on desktop, file/photo picker on mobile) → show
   **QR + room code** with a radar-waiting animation.
3. **Receiver** — scan QR (or enter code) → **splash connect** animation → linked.
4. **Transfer** — per-file progress as a **liquid fill**, transfer speed, total size,
   **success splash**. Allow sending more files **without re-pairing**.
5. **Received view** — download/save each file; use **Web Share API** on mobile.

---

## 6. Engineering quality bar

- **Theme tokens centralized** in `lib/theme/tokens.ts` (colors, motion durations, easing)
  so the entire look is tunable in one place.
- **Reusable primitives** — no copy-pasted button/card markup.
- **Robust edge handling (required):**
  - Connection drops mid-transfer → clear recovery / retry messaging.
  - Very large files → chunking must not freeze the UI (use streams / web workers if needed).
  - Unsupported browser → graceful message.
  - Camera denied → fall back to room-code entry automatically.
  - **iOS Safari WebRTC quirks** → handle explicitly and comment them.
- **Accessibility:** semantic HTML, keyboard nav, visible focus states, ARIA on
  interactive elements, and `prefers-reduced-motion` support (see ANIMATION.md).
- **Performance:** target 60fps; animate only `transform`/`opacity`; avoid layout thrash.

---

## 7. Build order (do this sequence)

1. Scaffold Next.js + Tailwind + theme tokens + PWA shell.
2. Build the **signaling server** and a WS client; verify two tabs can handshake.
3. Implement **WebRTC DataChannel** transfer with chunking + progress (function first,
   ugly UI is fine here).
4. Build **pairing UX** (QR generate + scan + room code fallback).
5. Wire the full **UX flow** end-to-end. Confirm a real file moves iOS↔desktop.
6. ONLY THEN layer in the **signature motion** (hero ripple, radar pulse, splash,
   liquid progress) per ANIMATION.md.
7. Edge cases, accessibility, README.

> Rule: **make it work, then make it beautiful.** Do not block functional transfer on
> animation polish.

---

## 8. Definition of done

- A real photo transfers from an iPhone (Safari) to a Windows PC (Chrome/Edge) on the
  same Wi-Fi, with no account and no file touching a server.
- Camera-denied path still works via room code.
- Installable as a PWA on all four platforms.
- README explains dev, PWA build, signaling deploy, and the privacy/offline model.
- The "drop" identity and motion are present and smooth (DESIGN.md + ANIMATION.md).
