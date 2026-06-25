"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion as m } from "framer-motion";
import { ArrowRight, QrCode, RotateCcw } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { QRDisplay } from "@/components/pairing/QRDisplay";
import { RoomCodeDisplay } from "@/components/pairing/RoomCode";
import { Radar } from "@/components/motion/Radar";
import { GroupToggle } from "@/components/pairing/GroupToggle";
import { LocalModeToggle } from "@/components/pairing/LocalModeToggle";
import { UnsupportedNotice } from "@/components/shared/UnsupportedNotice";
import { useSession } from "@/lib/session/SessionProvider";

/**
 * Send flow is CONNECT-FIRST: create a room, get the other device connected, THEN share
 * files on the live transfer screen. Pairing no longer races file selection — nothing is
 * sent until a DataChannel is confirmed open, which removes a class of "error while
 * sharing" bugs (queuing bytes before the peer is actually ready).
 */
export default function SendPage() {
  const router = useRouter();
  const session = useSession();
  const [groupOn, setGroupOn] = useState(false);
  const [localOn, setLocalOn] = useState(false);
  // After a while waiting for a device, surface a hint instead of waiting silently.
  const [slow, setSlow] = useState(false);

  const isGroup = session.capacity > 2;
  // Step 1 = pick options + create room (idle). Step 2 = pairing/connected/error.
  const onSetup = session.phase === "idle";

  // 1:1 → jump to the live transfer screen the moment the peer connects. Group → stay
  // on the invite screen so the host can add more devices, then continue manually.
  useEffect(() => {
    if (session.phase === "connected" && session.capacity <= 2) router.push("/transfer");
  }, [session.phase, session.capacity, router]);

  const waiting = session.phase === "pairing" && session.peerCount === 0;
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [waiting]);

  function createRoom() {
    session.host(groupOn ? 4 : 2, { local: localOn });
  }

  const joinUrl =
    session.roomCode && typeof window !== "undefined"
      ? `${window.location.origin}/receive?room=${session.roomCode}${
          session.localMode ? "&local=1" : ""
        }`
      : "";

  if (!session.supported) {
    return (
      <Shell>
        <UnsupportedNotice />
      </Shell>
    );
  }

  // ── Step 1 — choose options, then create a room ──────────────────────────────
  if (onSetup) {
    return (
      <Shell>
        <div className="w-full max-w-xl">
          <Heading
            title="Send files"
            subtitle="Create a room and connect the other device — then pick what to share."
          />
          <div className="mb-6 flex flex-col gap-3">
            <GroupToggle on={groupOn} onChange={setGroupOn} />
            <LocalModeToggle on={localOn} onChange={setLocalOn} />
          </div>
          <Button size="lg" className="w-full" onClick={createRoom}>
            <QrCode size={18} /> Create a room
          </Button>
          <p className="mt-3 text-center text-xs text-text-muted">
            You’ll choose files on the next screen, once a device has joined.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Step 2 — pairing: QR + room code + radar while waiting for peers ─────────
  return (
    <Shell>
      <div className="flex w-full max-w-xl flex-col items-center">
        <Heading
          title={isGroup ? "Invite up to 3 devices" : "Scan to connect"}
          subtitle={
            isGroup
              ? "Each device scans this code (or types it) to join the group."
              : "On the other device, open the camera or DropWave and scan this code."
          }
        />

        <Card className="relative flex flex-col items-center gap-6 p-8">
          {session.phase === "pairing" && session.peerCount === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-60">
              <Radar size={420} />
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center gap-5">
            {joinUrl && <QRDisplay value={joinUrl} />}
            {session.roomCode && <RoomCodeDisplay code={session.roomCode} />}

            <div className="flex items-center gap-2">
              {session.localMode && (
                <Badge tone="neutral">Local Wi-Fi mode</Badge>
              )}
              {session.peerCount > 0 ? (
                <Badge tone="aqua">
                  <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-aqua" />
                  {isGroup
                    ? `${session.peerCount} device${session.peerCount > 1 ? "s" : ""} connected`
                    : "Device found — connecting…"}
                </Badge>
              ) : session.peerPresent ? (
                <Badge tone="aqua">
                  <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-aqua" />
                  Device found — connecting…
                </Badge>
              ) : (
                <Badge>
                  <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-text-muted" />
                  {isGroup ? "Waiting for devices…" : "Looking for a device…"}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* group: a clear way to stop adding devices and start sharing */}
        {isGroup && session.peerCount > 0 && (
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 w-full"
          >
            <Button size="lg" className="w-full" onClick={() => router.push("/transfer")}>
              Start sharing with {session.peerCount} device
              {session.peerCount > 1 ? "s" : ""} <ArrowRight size={18} />
            </Button>
          </m.div>
        )}

        {slow && session.peerCount === 0 && (
          <p className="mt-4 max-w-sm text-center text-sm text-text-muted">
            Still waiting. On the other device, open this link or scan the QR — it should
            land on a “Connecting…” screen within a few seconds.
          </p>
        )}

        {session.error && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="max-w-sm text-center text-sm text-error">
              {session.error.message}
            </p>
            <Button variant="secondary" onClick={() => session.reset()}>
              <RotateCcw size={15} /> Start over
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh">
      <Header />
      <section className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-6 pb-20 pt-6">
        {children}
      </section>
    </main>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary">
        {title}
      </h1>
      <p className="mt-2 text-text-secondary">{subtitle}</p>
    </div>
  );
}
