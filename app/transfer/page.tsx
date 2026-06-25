"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion as m } from "framer-motion";
import {
  CheckCircle2,
  DownloadCloud,
  FolderCheck,
  FolderInput,
  HardDriveDownload,
  Plus,
  Power,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilePicker } from "@/components/transfer/FilePicker";
import { FileCard } from "@/components/transfer/FileCard";
import { Splash } from "@/components/motion/Splash";
import { useSession } from "@/lib/session/SessionProvider";
import { reveal } from "@/lib/theme/tokens";
import { cn, formatBytes } from "@/lib/utils";

export default function TransferPage() {
  const router = useRouter();
  const session = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

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

  // "Download all": trigger each received file's download in turn. A short gap between
  // clicks keeps browsers from collapsing them into a single blocked request (and the
  // first one may ask permission to download multiple files — expected).
  // Files held in memory (not streamed to disk) that can be saved via a download click.
  const downloadable = useMemo(
    () => session.received.filter((f) => !!f.url),
    [session.received]
  );

  async function downloadAll() {
    if (downloadingAll || downloadable.length === 0) return;
    setDownloadingAll(true);
    try {
      for (const f of downloadable) {
        const a = document.createElement("a");
        a.href = f.url!;
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      setDownloadingAll(false);
    }
  }

  async function share(id: string) {
    const file = receivedById.get(id);
    if (!file || !file.blob) return;
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
            {session.capacity > 2 && (
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Users size={13} />
                {session.peerCount} device{session.peerCount === 1 ? "" : "s"}
              </span>
            )}
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

        {/* Save-to-disk: stream incoming files straight to a folder (bounded memory) —
            essential for very large / many-file transfers. Chromium desktop only. */}
        {session.canSaveToDisk &&
          (session.saveFolderName ? (
            <div className="mb-6 flex items-center gap-2 rounded-card border border-success/40 bg-bone/60 px-4 py-3 text-sm text-text-secondary">
              <FolderCheck size={16} className="text-success" />
              Saving incoming files straight to{" "}
              <span className="font-medium text-text-primary">{session.saveFolderName}</span>
            </div>
          ) : (
            <div className="mb-6 flex flex-col gap-3 rounded-card border border-border-subtle bg-bone/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2 text-sm text-text-secondary">
                <HardDriveDownload size={16} className="mt-0.5 shrink-0 text-text-primary" />
                Sending many or very large files? Stream them straight to a folder — no size
                limit, and they’re saved as they arrive.
              </span>
              <Button
                variant="secondary"
                size="md"
                className="shrink-0"
                onClick={() => void session.chooseReceiveFolder()}
              >
                <FolderInput size={15} /> Choose folder
              </Button>
            </div>
          ))}

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
          <Section
            title="Receiving"
            action={
              downloadable.length >= 2 ? (
                <button
                  onClick={downloadAll}
                  disabled={downloadingAll}
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-pill border border-ink/30 bg-bone px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {/* ink-fill rises on hover (matches the landing's vignette hover) */}
                  <span className="absolute inset-0 translate-y-full bg-ink transition-transform duration-300 ease-out group-hover:translate-y-0 group-disabled:hidden" />
                  <DownloadCloud
                    size={15}
                    className={cn(
                      "relative z-10 transition-colors group-hover:text-paper",
                      downloadingAll && "animate-bounce"
                    )}
                  />
                  <span className="relative z-10 transition-colors group-hover:text-paper">
                    {downloadingAll ? "Saving…" : `Download all · ${downloadable.length}`}
                  </span>
                </button>
              ) : null
            }
          >
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
                        saved={!!got?.savedToDisk}
                        canShare={canShare && !!got?.blob}
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

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}
