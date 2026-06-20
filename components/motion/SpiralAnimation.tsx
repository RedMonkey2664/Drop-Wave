"use client";

/**
 * SpiralAnimation — a GSAP-driven spiral "warp" of particles, used as the hero
 * backdrop behind the DropWave wordmark. Adapted from a community canvas spiral and
 * reworked for production:
 *   • SSR-safe (no window access at module load; sizes from a ResizeObserver).
 *   • Themed to the brand (aqua/violet particles on the near-black abyss canvas, so it
 *     blends seamlessly with the page background).
 *   • Performance-first: device-pixel-ratio capped, particle count scaled to screen
 *     width, and the GSAP timeline is PAUSED whenever the hero scrolls out of view
 *     (IntersectionObserver) so it never burns CPU off-screen.
 *   • Reduced motion: renders nothing (a calm static gradient sits behind instead).
 */

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const MAX_DPR = 1.5;

class Vec2 {
  constructor(public x: number, public y: number) {}
}
class Vec3 {
  constructor(public x: number, public y: number, public z: number) {}
}

class Star {
  dx: number;
  dy: number;
  spiralLocation: number;
  strokeWeightFactor: number;
  z: number;
  angle: number;
  distance: number;
  rotationDirection: number;
  expansionRate: number;
  finalScale: number;

  constructor(cameraZ: number, cameraTravelDistance: number) {
    this.angle = Math.random() * Math.PI * 2;
    this.distance = 30 * Math.random() + 15;
    this.rotationDirection = Math.random() > 0.5 ? 1 : -1;
    this.expansionRate = 1.2 + Math.random() * 0.8;
    this.finalScale = 0.7 + Math.random() * 0.6;
    this.dx = this.distance * Math.cos(this.angle);
    this.dy = this.distance * Math.sin(this.angle);
    this.spiralLocation = (1 - Math.pow(1 - Math.random(), 3.0)) / 1.3;
    this.z = 0.5 * cameraZ + Math.random() * (cameraTravelDistance + cameraZ - 0.5 * cameraZ);
    this.z = this.z * (1 - 0.3 * this.spiralLocation) + (cameraTravelDistance / 2) * (0.3 * this.spiralLocation);
    this.strokeWeightFactor = Math.pow(Math.random(), 2.0);
  }

  render(p: number, c: SpiralController) {
    const spiralPos = c.spiralPath(this.spiralLocation);
    const q = p - this.spiralLocation;
    if (q <= 0) return;

    const dp = c.constrain(4 * q, 0, 1);
    const elastic = c.easeOutElastic(dp);
    const power = Math.pow(dp, 2);
    let screenX: number, screenY: number;

    if (dp < 0.3) {
      const e = c.lerp(dp, power, dp / 0.3);
      screenX = c.lerp(spiralPos.x, spiralPos.x + this.dx * 0.3, e / 0.3);
      screenY = c.lerp(spiralPos.y, spiralPos.y + this.dy * 0.3, e / 0.3);
    } else if (dp < 0.7) {
      const mid = (dp - 0.3) / 0.4;
      const curve = Math.sin(mid * Math.PI) * this.rotationDirection * 1.5;
      const baseX = spiralPos.x + this.dx * 0.3;
      const baseY = spiralPos.y + this.dy * 0.3;
      const targetX = spiralPos.x + this.dx * 0.7;
      const targetY = spiralPos.y + this.dy * 0.7;
      const perpX = -this.dy * 0.4 * curve;
      const perpY = this.dx * 0.4 * curve;
      screenX = c.lerp(baseX, targetX, mid) + perpX * mid;
      screenY = c.lerp(baseY, targetY, mid) + perpY * mid;
    } else {
      const fin = (dp - 0.7) / 0.3;
      const baseX = spiralPos.x + this.dx * 0.7;
      const baseY = spiralPos.y + this.dy * 0.7;
      const targetDistance = this.distance * this.expansionRate * 1.5;
      const spiralAngle = this.angle + 1.2 * this.rotationDirection * fin * Math.PI;
      const targetX = spiralPos.x + targetDistance * Math.cos(spiralAngle);
      const targetY = spiralPos.y + targetDistance * Math.sin(spiralAngle);
      screenX = c.lerp(baseX, targetX, fin);
      screenY = c.lerp(baseY, targetY, fin);
      void elastic;
    }

    const vx = ((this.z - c.cameraZ) * screenX) / c.viewZoom;
    const vy = ((this.z - c.cameraZ) * screenY) / c.viewZoom;

    let sizeMul = 1.0;
    if (dp < 0.6) sizeMul = 1.0 + dp * 0.2;
    else {
      const t = (dp - 0.6) / 0.4;
      sizeMul = 1.2 * (1 - t) + this.finalScale * t;
    }
    const dotSize = 8.5 * this.strokeWeightFactor * sizeMul;
    c.showProjectedDot(new Vec3(vx, vy, this.z), dotSize);
  }
}

class SpiralController {
  private tl: gsap.core.Timeline;
  private time = 0;
  private stars: Star[] = [];
  readonly cameraZ = -400;
  readonly cameraTravelDistance = 3400;
  readonly viewZoom = 100;
  private readonly changeEventTime = 0.32;
  private readonly startDotYOffset = 28;
  private readonly trailLength = 60;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
    numberOfStars: number
  ) {
    for (let i = 0; i < numberOfStars; i++) {
      this.stars.push(new Star(this.cameraZ, this.cameraTravelDistance));
    }
    this.tl = gsap.timeline({ repeat: -1 });
    this.tl.to(this, {
      time: 1,
      duration: 18, // slower drift = calmer, more premium
      repeat: -1,
      ease: "none",
      onUpdate: () => this.render(),
    });
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  ease(p: number, g: number) {
    return p < 0.5 ? 0.5 * Math.pow(2 * p, g) : 1 - 0.5 * Math.pow(2 * (1 - p), g);
  }
  easeOutElastic(x: number) {
    const c4 = (2 * Math.PI) / 4.5;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return Math.pow(2, -8 * x) * Math.sin((x * 8 - 0.75) * c4) + 1;
  }
  map(v: number, a: number, b: number, c: number, d: number) {
    return c + (d - c) * ((v - a) / (b - a));
  }
  constrain(v: number, lo: number, hi: number) {
    return Math.min(Math.max(v, lo), hi);
  }
  lerp(a: number, b: number, t: number) {
    return a * (1 - t) + b * t;
  }

  spiralPath(p: number) {
    p = this.constrain(1.2 * p, 0, 1);
    p = this.ease(p, 1.8);
    const turns = 6;
    const theta = 2 * Math.PI * turns * Math.sqrt(p);
    const r = 170 * Math.sqrt(p);
    return new Vec2(r * Math.cos(theta), r * Math.sin(theta) + this.startDotYOffset);
  }

  showProjectedDot(position: Vec3, sizeFactor: number) {
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);
    const newCameraZ = this.cameraZ + this.ease(Math.pow(t2, 1.2), 1.8) * this.cameraTravelDistance;
    if (position.z <= newCameraZ) return;
    const depth = position.z - newCameraZ;
    const x = (this.viewZoom * position.x) / depth;
    const y = (this.viewZoom * position.y) / depth;
    const sw = (400 * sizeFactor) / depth;
    this.ctx.beginPath();
    this.ctx.arc(x, y, Math.max(0.4, sw / 2), 0, Math.PI * 2);
    this.ctx.fill();
  }

  private render() {
    const ctx = this.ctx;
    ctx.fillStyle = "#06060A";
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);

    const t1 = this.constrain(this.map(this.time, 0, this.changeEventTime + 0.25, 0, 1), 0, 1);
    const t2 = this.constrain(this.map(this.time, this.changeEventTime, 1, 0, 1), 0, 1);
    ctx.rotate(-Math.PI * this.ease(t2, 2.7));

    // Seamless loop: ramp the whole field up at the start of a cycle and down at the
    // end, so the time→0 reset happens while the canvas is dark and is never visible.
    // The warp then appears to loop forever with no seam.
    const loopAlpha = Math.min(
      this.constrain(this.map(this.time, 0, 0.16, 0, 1), 0, 1),
      this.constrain(this.map(this.time, 0.82, 1, 1, 0), 0, 1)
    );
    // Additive blending — overlapping particles bloom like a luminous galaxy.
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = loopAlpha;

    // trail — bright aqua core
    for (let i = 0; i < this.trailLength; i++) {
      const f = this.map(i, 0, this.trailLength, 1.1, 0.1);
      const sw = (1.3 * (1 - t1) + 3.0 * Math.sin(Math.PI * t1)) * f;
      ctx.fillStyle = `rgba(120,240,255,${0.6 * f})`;
      const pos = this.spiralPath(t1 - 0.00015 * i);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, Math.max(0.4, sw / 2), 0, Math.PI * 2);
      ctx.fill();
    }

    // stars — alternating aqua / violet for brand depth (lower alpha; glow builds via "lighter")
    for (let s = 0; s < this.stars.length; s++) {
      ctx.fillStyle = s % 3 === 0 ? "rgba(150,128,255,0.6)" : "rgba(170,240,255,0.55)";
      this.stars[s].render(t1, this);
    }

    // start dot
    if (this.time > this.changeEventTime) {
      const dy = (this.cameraZ * this.startDotYOffset) / this.viewZoom;
      ctx.fillStyle = "rgba(210,248,255,0.9)";
      this.showProjectedDot(new Vec3(0, dy, this.cameraTravelDistance), 2.5);
    }

    ctx.restore();
  }

  pause() {
    this.tl.pause();
  }
  resume() {
    this.tl.play();
  }
  destroy() {
    this.tl.kill();
  }
}

export function SpiralAnimation({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<SpiralController | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    const setSize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ctrlRef.current) ctrlRef.current.resize(w, h);
      return { w, h };
    };

    const initial = setSize();
    if (!initial) return;

    // Scale particle budget to screen so phones stay smooth.
    const stars = initial.w < 640 ? 650 : initial.w < 1100 ? 1100 : 1500;
    ctrlRef.current = new SpiralController(ctx, initial.w, initial.h, stars);
    // Let a frame render, then fade the canvas in so it never pops in abruptly.
    requestAnimationFrame(() => setVisible(true));

    // Pause when the hero scrolls out of view (saves CPU/battery).
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!ctrlRef.current) return;
        if (entry.isIntersecting) ctrlRef.current.resume();
        else ctrlRef.current.pause();
      },
      { threshold: 0.01 }
    );
    io.observe(wrap);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(setSize, 150);
    });
    ro.observe(wrap);

    const onVisibility = () => {
      if (!ctrlRef.current) return;
      if (document.hidden) ctrlRef.current.pause();
      else ctrlRef.current.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      ctrlRef.current?.destroy();
      ctrlRef.current = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      aria-hidden
      style={{ opacity: visible ? 1 : 0, transition: "opacity 1.6s ease-out" }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
