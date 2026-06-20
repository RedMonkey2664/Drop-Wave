"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion as m } from "framer-motion";
import { CheckCircle2, Plus, Power, Wifi, WifiOff } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePicker } from "@/components/transfer/FilePicker";
import { FileCard } from "@/components/transfer/FileCard";
import { Splash } from "@/components/motion/Splash";
import { useSession } from "@/lib/session/SessionProvider";
import { reveal } from "@/lib/theme/tokens";
import { formatBytes } from "@/lib/utils";

export default function TransferPage() {
  const router = useRouter();
  const session = useSession();
  const [showPicker, setShowPicker] = useState(false);

  // Guard: if there's no live session (e.g. direct navigation / refresh), go home.
  useEffect(() => {
    if (session.phase === "idle") router.replace("/");
  }, [session.phase, router]);

  // Map received blobs by id so completed incoming files get download/share actions.
  const receivedById = useMemo(() => {
    const map = new Map<string, (typeof session.received)[number]>();
    session.received.forEach((f) => map.set(f.id, f));
    return map;
  }, [session.received]);

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share(id: string) {
    const file = receivedById.get(id);
    if (!file) return;
    try {
      const f = new File([file.blob], file.name, { type: file.type });
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: file.name });
      } else {
        await navigator.share({ title: file.name, url: file.url });
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  const connected = session.channelOpen && session.connectionState === "connected";
  const unstable =
    session.connectionState === "disconnected" ||
    session.connectionState === "connecting";

  const hasOutgoing = session.outgoing.length > 0;
  const hasIncoming = session.incoming.length > 0;
  const allOutgoingDone =
    hasOutgoing && session.outgoing.every((f) => f.status === "done");
  const totalReceived = session.received.reduce((n, f) => n + f.size, 0);

  return (
    <main className="min-h-dvh">
      <Header />
      <section className="relative mx-auto flex w-full max-w-[640px] flex-col px-6 pb-24 pt-6">
        <Splash trigger={session.connectNonce} />

        {/* connection status */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {connected ? (
              <Badge tone="success">
                <Wifi size={13} /> Connected
              </Badge>
            ) : unstable ? (
              <Badge tone="warning">
                <WifiOff size={13} /> Reconnecting…
              </Badge>
            ) : (
              <Badge tone="error">
                <WifiOff size={13} /> Disconnected
              </Badge>
            )}
            <span className="font-mono text-xs text-text-muted">
              room {session.roomCode}
            </span>
          </div>
          <button
            onClick={() => {
              session.reset();
              router.push("/");
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
          >
            <Power size={14} /> End
          </button>
        </div>

        {/* peer-left recovery message */}
        {session.phase === "pairing" && !connected && (
          <Card className="mb-6 p-5 text-center text-sm text-text-secondary">
            The other device dropped off. Keep this open — it’ll reconnect automatically
            if they rejoin room{" "}
            <span className="font-mono text-text-primary">{session.roomCode}</span>.
          </Card>
        )}

        {/* SENDING */}
        {hasOutgoing && (
          <Section title={allOutgoingDone ? "Sent" : "Sending"}>
            <m.div
              variants={reveal.container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3"
            >
              <AnimatePresence initial={false}>
                {session.outgoing.map((file) => (
                  <m.div key={file.id} variants={reveal.item} layout>
                    <FileCard
                      file={file}
                      direction="out"
                      onCancel={() => session.cancelOutgoing(file.id)}
                    />
                  </m.div>
                ))}
              </AnimatePresence>
            </m.div>
          </Section>
        )}

        {/* RECEIVING */}
        {hasIncoming && (
          <Section title="Receiving">
            <m.div
              variants={reveal.container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3"
            >
              <AnimatePresence initial={false}>
                {session.incoming.map((file) => {
                  const got = receivedById.get(file.id);
                  return (
                    <m.div key={file.id} variants={reveal.item} layout>
                      <FileCard
                        file={file}
                        direction="in"
                        downloadUrl={got?.url}
                        canShare={canShare && !!got}
                        onShare={() => share(file.id)}
                      />
                    </m.div>
                  );
                })}
              </AnimatePresence>
            </m.div>
            {session.received.length > 0 && (
              <p className="mt-3 flex items-center justify-center gap-2 text-sm text-success">
                <CheckCircle2 size={15} />
                {session.received.length} file{session.received.length > 1 ? "s" : ""}{" "}
                received · {formatBytes(totalReceived)}
              </p>
            )}
          </Section>
        )}

        {/* empty connected state */}
        {!hasOutgoing && !hasIncoming && connected && (
          <Card className="p-10 text-center">
            <p className="text-text-secondary">
              You’re connected. Send a file below — or wait for one to arrive.
            </p>
          </Card>
        )}

        {/* SEND MORE — without re-pairing */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {showPicker ? (
              <m.div
                key="picker"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
              >
                <FilePicker
                  onFiles={(files) => {
                    session.sendFiles(files);
                    setShowPicker(false);
                  }}
                />
              </m.div>
            ) : (
              <m.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  disabled={!connected}
                  onClick={() => setShowPicker(true)}
                >
                  <Plus size={18} /> Send more files
                </Button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}
