"use client";

/**
 * QRScanner — camera viewfinder + QR decode for the receiver (DESIGN.md "Pairing
 * (receiver)"). Uses getUserMedia for the rear camera and jsQR to decode frames drawn
 * to an offscreen canvas.
 *
 * Edge handling (CLAUDE.md):
 *   • Camera denied / unavailable → calls onUnavailable so the parent auto-falls back
 *     to room-code entry. We NEVER trap the user on a dead camera screen.
 *   • iOS Safari quirks: video needs `playsInline` + `muted` + autoplay, and a secure
 *     origin (https/localhost). We request `facingMode: environment` for the rear lens.
 *   • Scan loop runs on requestAnimationFrame and is fully torn down on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export function QRScanner({
  onResult,
  onUnavailable,
}: {
  onResult: (text: string) => void;
  onUnavailable: (reason: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || doneRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx && w && h) {
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          doneRef.current = true;
          stop();
          onResult(code.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scan);
  }, [onResult, stop]);

  useEffect(() => {
    doneRef.current = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      onUnavailable("no-camera-api");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (doneRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true"); // iOS Safari
        video.muted = true;
        video
          .play()
          .then(() => {
            setReady(true);
            rafRef.current = requestAnimationFrame(scan);
          })
          .catch(() => onUnavailable("video-play-failed"));
      })
      .catch((err: DOMException) => {
        // NotAllowedError (denied), NotFoundError (no camera), etc.
        onUnavailable(err?.name || "camera-error");
      });

    return () => stop();
  }, [onUnavailable, scan, stop]);

  return (
    <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-card border border-border-subtle bg-abyss shadow-glow">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
        aria-label="Camera viewfinder for scanning a pairing QR code"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* scan-line guide framing */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-8 rounded-2xl border-2 border-aqua/50" />
        {ready && (
          <div className="absolute inset-x-8 top-8 h-0.5 animate-[scanline_2.4s_ease-in-out_infinite] bg-aqua shadow-glow" />
        )}
      </div>

      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-sm text-text-secondary">
          Starting camera…
        </div>
      )}

      <style jsx>{`
        @keyframes scanline {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(220px);
          }
        }
      `}</style>
    </div>
  );
}
