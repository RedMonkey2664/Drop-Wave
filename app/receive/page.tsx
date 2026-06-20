"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ScanLine } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QRScanner } from "@/components/pairing/QRScanner";
import { RoomCodeEntry } from "@/components/pairing/RoomCode";
import { Splash } from "@/components/motion/Splash";
import { UnsupportedNotice } from "@/components/shared/UnsupportedNotice";
import { useSession } from "@/lib/session/SessionProvider";
import { normalizeRoomCode } from "@/lib/utils";

/** Extract a room code from a scanned value — either a join URL or a bare code. */
function roomFromScan(value: string): string | null {
  try {
    const url = new URL(value);
    const room = url.searchParams.get("room");
    if (room) return normalizeRoomCode(room);
  } catch {
    /* not a URL — fall through */
  }
  const bare = normalizeRoomCode(value);
  return bare.length >= 4 ? bare : null;
}

function ReceiveInner() {
  const router = useRouter();
  const session = useSession();
  const params = useSearchParams();
  const presetRoom = params.get("room");

  // "scan" (camera), "code" (manual entry), or "connecting".
  const [mode, setMode] = useState<"scan" | "code" | "connecting">(
    presetRoom ? "connecting" : "scan"
  );
  const [cameraReason, setCameraReason] = useState<string | null>(null);

  // Auto-join when arriving from a scanned QR link (?room=CODE).
  useEffect(() => {
    if (presetRoom && session.phase === "idle") {
      session.join(presetRoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetRoom]);

  // On connect, go to the transfer screen.
  useEffect(() => {
    if (session.phase === "connected") router.push("/transfer");
  }, [session.phase, router]);

  function connect(code: string) {
    setMode("connecting");
    session.join(code);
  }

  if (!session.supported) {
    return <UnsupportedNotice />;
  }

  if (mode === "connecting" || session.phase === "pairing") {
    return (
      <Card glow className="relative flex max-w-md flex-col items-center gap-5 p-10 text-center">
        <Splash trigger={session.connectNonce} />
        <div className="grid h-16 w-16 place-items-center rounded-full border border-aqua/40">
          <span className="h-3 w-3 animate-breathe rounded-full bg-aqua" />
        </div>
        <h2 className="font-display text-xl font-semibold text-text-primary">
          {session.peerPresent ? "Connecting…" : "Reaching the other device…"}
        </h2>
        <p className="text-sm text-text-secondary">
          Room <span className="font-mono text-text-primary">{session.roomCode}</span>
        </p>
        {session.error && <p className="text-sm text-error">{session.error.message}</p>}
      </Card>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">
          Receive a file
        </h1>
        <p className="mt-2 text-text-secondary">
          {mode === "scan"
            ? "Point your camera at the QR code on the sending device."
            : "Type the room code shown on the sending device."}
        </p>
      </div>

      {mode === "scan" ? (
        <div className="flex w-full flex-col items-center gap-5">
          <QRScanner
            onResult={(text) => {
              const room = roomFromScan(text);
              if (room) connect(room);
            }}
            onUnavailable={(reason) => {
              // Camera denied/absent → auto-fall back to code entry (CLAUDE.md).
              setCameraReason(reason);
              setMode("code");
            }}
          />
          <button
            onClick={() => setMode("code")}
            className="flex items-center gap-2 text-sm text-text-secondary underline-offset-4 hover:text-aqua hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60"
          >
            <KeyRound size={15} /> Enter code instead
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-5">
          {cameraReason && (
            <Badge tone="warning">
              Camera unavailable — enter the code instead
            </Badge>
          )}
          <Card className="w-full p-6">
            <RoomCodeEntry onSubmit={connect} autoFocus />
          </Card>
          <button
            onClick={() => {
              setCameraReason(null);
              setMode("scan");
            }}
            className="flex items-center gap-2 text-sm text-text-secondary underline-offset-4 hover:text-aqua hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/60"
          >
            <ScanLine size={15} /> Scan a QR code instead
          </button>
        </div>
      )}
    </div>
  );
}

export default function ReceivePage() {
  return (
    <main className="min-h-dvh">
      <Header />
      <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pb-20 pt-6">
        <Suspense fallback={<div className="text-text-muted">Loading…</div>}>
          <ReceiveInner />
        </Suspense>
      </section>
    </main>
  );
}
