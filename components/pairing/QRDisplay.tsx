"use client";

/**
 * QRDisplay — renders a QR code for the receiver to scan (DESIGN.md "Pairing (sender)").
 * The QR encodes a join URL containing the room code, so scanning opens DropWave's
 * receive flow pre-filled and connects instantly.
 *
 * Generated client-side with the `qrcode` lib onto a canvas, themed dark with an aqua
 * module color so it reads as part of the brand rather than a stark black/white block.
 */

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export function QRDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: {
        // Ink modules on paper — flat editorial theme.
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    }).catch(() => setError(true));
  }, [value, size]);

  if (error) {
    return (
      <div
        className="grid place-items-center rounded-card border border-border-subtle bg-elevated text-center text-sm text-text-muted"
        style={{ width: size, height: size }}
      >
        QR unavailable — use the room code below.
      </div>
    );
  }

  return (
    <div className="relative inline-grid place-items-center rounded-card bg-abyss p-3 shadow-glow">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg"
        aria-label="QR code to pair this device"
      />
    </div>
  );
}
