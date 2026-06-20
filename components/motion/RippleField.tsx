"use client";

/**
 * RippleField — the landing-page background animation. Faint ink ripple rings expand
 * and fade across the warm putty canvas, like raindrops landing on still water — the
 * literal "DropWave" metaphor, rendered in the flat editorial palette (monochrome, low
 * opacity, no color) so it's eye-catching without fighting the typography.
 *
 * One <canvas>, plain requestAnimationFrame (no deps). dpr-capped, pauses when the tab
 * is hidden, and renders nothing under prefers-reduced-motion. It fills with putty and
 * draws over it, so it sits behind the light sections; the ink sections paint on top.
 */

import { useEffect, useRef } from "react";

const PUTTY = "#c4c3b6";
const MAX_DPR = 1.5;

interface Ripple {
  x: number;
  y: number;
  born: number;
  maxR: number;
  dur: number;
}

export function RippleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    let w = 0;
    let h = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ripples: Ripple[] = [];
    const spawn = (x?: number, y?: number) => {
      ripples.push({
        x: x ?? Math.random() * w,
        y: y ?? Math.random() * h,
        born: performance.now(),
        maxR: 160 + Math.random() * 260,
        dur: 3800 + Math.random() * 2600,
      });
    };
    // seed a few so it's alive immediately, staggered in time
    for (let i = 0; i < 4; i++) {
      ripples.push({
        x: Math.random() * w,
        y: Math.random() * h,
        born: performance.now() - Math.random() * 3000,
        maxR: 160 + Math.random() * 260,
        dur: 3800 + Math.random() * 2600,
      });
    }

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const SPAWN_EVERY = 900; // ms

    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      while (acc >= SPAWN_EVERY) {
        acc -= SPAWN_EVERY;
        if (ripples.length < 14) spawn();
      }

      ctx.fillStyle = PUTTY;
      ctx.fillRect(0, 0, w, h);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const age = (now - r.born) / r.dur;
        if (age >= 1) {
          ripples.splice(i, 1);
          continue;
        }
        const radius = easeOut(age) * r.maxR;
        const fade = (1 - age) * 0.16;
        // two concentric rings per drop for a watery feel
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(0,0,0,${fade})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        if (radius > 26) {
          ctx.strokeStyle = `rgba(0,0,0,${fade * 0.6})`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, radius - 18, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // a ripple where the user clicks, for a touch of interactivity
    const onClick = (e: MouseEvent) => spawn(e.clientX, e.clientY);
    window.addEventListener("pointerdown", onClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onClick);
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
