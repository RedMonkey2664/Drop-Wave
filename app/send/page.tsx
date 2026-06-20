"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion as m } from "framer-motion";
import { FileUp } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FilePicker } from "@/components/transfer/FilePicker";
import { QRDisplay } from "@/components/pairing/QRDisplay";
import { RoomCodeDisplay } from "@/components/pairing/RoomCode";
import { Radar } from "@/components/motion/Radar";
import { UnsupportedNotice } from "@/components/shared/UnsupportedNotice";
import { useSession } from "@/lib/session/SessionProvider";
import { formatBytes } from "@/lib/utils";

export default function SendPage() {
  const router = useRouter();
  const session = useSession();
  const [selected, setSelected] = useState<File[]>([]);
  // After a while waiting for a device, surface a hint instead of waiting silently.
  const [slow, setSlow] = useState(false);

  // Once the peer connects, move to the live transfer screen (queued files auto-send).
  useEffect(() => {
    if (session.phase === "connected") router.push("/transfer");
  }, [session.phase, router]);

  const waiting = session.phase === "pairing" && !session.peerPresent;
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [waiting]);

  function handleFiles(files: File[]) {
    setSelected((prev) => [...prev, ...files]);
    // Start pairing on first selection. host() resets any prior session, so we queue
    // the files AFTER it to ensure they survive into the new session and auto-send
    // the moment the channel opens.
    if (session.phase === "idle") session.host();
    session.sendFiles(files);
  }

  const joinUrl = useMemo(() => {
    if (!session.roomCode || typeof window === "undefined") return "";
    return `${window.location.origin}/receive?room=${session.roomCode}`;
  }, [session.roomCode]);

  const totalBytes = selected.reduce((n, f) => n + f.size, 0);

  if (!session.supported) {
    return <Shell><UnsupportedNotice /></Shell>;
  }

  // Step 1 — pick files.
  if (selected.length === 0) {
    return (
      <Shell>
        <div className="w-full max-w-xl">
          <Heading
            title="Send a file"
            subtitle="Pick what to send, then show the code to the other device."
          />
          <FilePicker onFiles={handleFiles} />
        </div>
      </Shell>
    );
  }

  // Step 2 — pairing: QR + room code + radar while waiting for a peer.
  return (
    <Shell>
      <div className="flex w-full max-w-xl flex-col items-center">
        <Heading
          title="Scan to receive"
          subtitle="On the other device, open the camera or DropWave and scan this code."
        />

        <Card glow className="relative flex flex-col items-center gap-6 p-8">
          {/* radar pulses behind the QR while waiting */}
          {session.phase === "pairing" && !session.peerPresent && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-60">
              <Radar size={420} />
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center gap-5">
            {joinUrl && <QRDisplay value={joinUrl} />}
            {session.roomCode && <RoomCodeDisplay code={session.roomCode} />}

            <div className="flex items-center gap-2">
              {session.peerPresent ? (
                <Badge tone="aqua">
                  <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-aqua" />
                  Device found — connecting…
                </Badge>
              ) : (
                <Badge>
                  <span className="h-1.5 w-1.5 animate-breathe rounded-full bg-text-muted" />
                  Looking for a device…
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* selected files summary */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex w-full items-center justify-between rounded-card border border-border-subtle bg-surface/60 px-5 py-3 text-sm"
        >
          <span className="flex items-center gap-2 text-text-secondary">
            <FileUp size={16} className="text-aqua" />
            {selected.length} file{selected.length > 1 ? "s" : ""} ready
          </span>
          <span className="font-mono text-text-muted">{formatBytes(totalBytes)}</span>
        </m.div>

        {slow && (
          <p className="mt-4 max-w-sm text-center text-sm text-text-muted">
            Still waiting. On the other device, open this link or scan the QR — it should
            land on a “Connecting…” screen within a few seconds.
          </p>
        )}

        {session.error && (
          <p className="mt-4 text-center text-sm text-error">{session.error.message}</p>
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
