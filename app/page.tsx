"use client";

/**
 * Landing page — "Structured" editorial restyle, with restrained-but-rich motion.
 *
 * Warm putty gallery canvas, a monumental serif wordmark cropped at the viewport edges,
 * alternating light/ink full-bleed sections with hard cuts. Motion is editorial:
 *   • mask-rise reveals (text slides up from behind a clip) on the hero + every heading,
 *   • a slow serif marquee band,
 *   • parallax on the giant wordmark,
 *   • rotating hairline rings + hover ink-fills on the step vignettes.
 * All of it has calm reduced-motion fallbacks.
 */

import { useRef } from "react";
import Link from "next/link";
import {
  motion as m,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { LandingNav } from "@/components/ui/LandingNav";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Wordmark";
import { TransferDemo } from "@/components/motion/TransferDemo";
import { RippleField } from "@/components/motion/RippleField";
import { BRAND } from "@/lib/theme/tokens";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function LandingPage() {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const wordY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -80]);

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      {/* on-brand background: faint ink drop-ripples on the putty canvas */}
      <RippleField />
      <LandingNav />

      {/* ───────────────────────── HERO (light / putty) ───────────────────────── */}
      <section
        ref={heroRef}
        className="relative mx-auto flex min-h-[88vh] w-full max-w-[1200px] flex-col px-6 pb-0 pt-10"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-7 pb-6 text-center">
          <m.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="font-sans text-[12px] uppercase tracking-[0.22em] text-graphite"
          >
            Peer&#8209;to&#8209;peer file transfer
          </m.span>

          <h1 className="max-w-3xl font-display text-[clamp(2rem,5.2vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.02em] text-ink">
            <Rise delay={0.05}>
              Send a file. It <span className="italic text-graphite">lands</span> anywhere.
            </Rise>
          </h1>

          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 font-sans text-[15px] font-medium text-ink"
          >
            <StatPair label="WORKS ON" value="iOS · Android · Windows · macOS" />
            <span className="hidden h-4 w-px bg-vellum sm:block" />
            <StatPair label="ON OUR SERVERS" value="0 files" />
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-1 flex items-center gap-4"
          >
            <Link href="/send">
              <Button size="lg">Send a file</Button>
            </Link>
            <Link href="/receive">
              <Button variant="secondary" size="lg">
                Receive
              </Button>
            </Link>
          </m.div>
        </div>

        {/* monumental wordmark — cropped left/right by the page (overflow-x-clip on
            <main>), with NO vertical clipping so the full letters show, the p's
            descender included. Gentle fade-up entrance + scroll parallax. */}
        <div className="relative left-1/2 w-screen -translate-x-1/2">
          <m.div style={{ y: wordY }} className="flex justify-center">
            <m.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 64 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
              className="will-change-transform"
            >
              <Wordmark
                italicSecond
                className="block whitespace-nowrap text-center text-[clamp(5rem,25vw,22rem)] leading-[1.06] [padding-bottom:0.06em]"
              />
            </m.div>
          </m.div>
        </div>
      </section>

      {/* ───────────────── SEE FILES MOVE (dark / ink room) ───────────────── */}
      <section
        id="see-files-move"
        className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-20 bg-ink py-[96px] text-paper"
      >
        <div className="mx-auto w-full max-w-[1120px] px-6">
          <SectionLabel tone="dark" left="See files move" right="01 / Transfer" />
          <RiseHeading className="mx-auto mb-12 max-w-4xl text-center font-display text-[clamp(2.25rem,6vw,5rem)] font-medium leading-[0.9] tracking-[-0.02em]">
            One file, flying <span className="italic">device to device</span>
          </RiseHeading>

          <m.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <TransferDemo />
          </m.div>

          <p className="mx-auto mt-10 max-w-xl text-center font-sans text-[15px] leading-relaxed text-paper/70">
            The arc is the live encrypted channel between the two devices — not a detour
            through a server. On the same Wi-Fi it never even leaves your network.
          </p>
        </div>
      </section>

      {/* ───────────────────── HOW IT WORKS (light) ───────────────────── */}
      <section id="how-it-works" className="mx-auto w-full max-w-[1120px] scroll-mt-20 px-6 py-[96px]">
        <SectionLabel left="How it works" right="Pair · Drop · Done" />
        <RiseHeading className="mb-16 text-center font-display text-[clamp(2.25rem,6vw,5.25rem)] font-medium leading-[0.9] tracking-[-0.02em] text-ink">
          Three taps, then it flows
        </RiseHeading>

        <m.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14 } } }}
          className="grid gap-12 sm:grid-cols-3"
        >
          {STEPS.map((s) => (
            <m.div
              key={s.n}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
              }}
              className="flex flex-col items-center text-center"
            >
              <p className="mb-6 font-display text-[24px] font-medium text-ink">{s.title}</p>
              <Vignette numeral={s.n} />
              <Hexagon className="mt-6 text-ink/40" />
              <p className="mt-5 max-w-[15rem] font-sans text-[15px] leading-relaxed text-graphite">
                {s.body}
              </p>
            </m.div>
          ))}
        </m.div>
      </section>

      {/* ───────────────────── PRIVATE BY DESIGN (dark / ink room) ───────────────────── */}
      <section
        id="private"
        className="relative left-1/2 w-screen -translate-x-1/2 scroll-mt-20 bg-ink py-[96px] text-paper"
      >
        <div className="mx-auto w-full max-w-[1120px] px-6">
          <SectionLabel tone="dark" left="Private by design" right="02 / Trust" />
          <RiseHeading className="mx-auto mb-10 max-w-4xl text-center font-display text-[clamp(2.25rem,6vw,5rem)] font-medium leading-[0.9] tracking-[-0.02em]">
            The file never touches a server
          </RiseHeading>

          <m.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-12 gap-y-6 border-y border-paper/15 py-8 font-sans text-[16px] font-medium"
          >
            <StatPair tone="dark" label="ENCRYPTION" value="256-bit, by default" />
            <StatPair tone="dark" label="TRANSPORT" value="WebRTC P2P" />
            <StatPair tone="dark" label="ACCOUNTS" value="None" />
          </m.div>

          <p className="mx-auto mt-10 max-w-2xl text-center font-sans text-[15px] leading-relaxed text-paper/60">
            A note on how this works: scanning a QR code to pair is the unavoidable price
            of “no install, runs in any browser.” It isn’t zero-tap like AirDrop — browsers
            can’t silently discover devices on your network — but it’s the smoothest
            version that genuinely works iPhone ↔ Windows, with nothing to download.
          </p>
        </div>
      </section>

      {/* ───────────────────────── CLOSING CTA (light) ───────────────────────── */}
      <section className="mx-auto w-full max-w-[1120px] px-6 py-[120px] text-center">
        <RiseHeading className="font-display text-[clamp(2.5rem,8vw,6rem)] font-medium leading-[0.88] tracking-[-0.02em] text-ink">
          Ready when <span className="italic text-graphite">you</span> are.
        </RiseHeading>
        <p className="mx-auto mt-6 max-w-md font-sans text-[15px] leading-relaxed text-graphite">
          No sign-up. No app store. Open it on both devices and send.
        </p>
        <div className="mt-9 flex items-center justify-center gap-4">
          <Link href="/send">
            <Button size="lg">Send a file</Button>
          </Link>
          <Link href="/receive">
            <Button variant="secondary" size="lg">
              Receive
            </Button>
          </Link>
        </div>
      </section>

      {/* footer (chalk) */}
      <footer className="relative left-1/2 w-screen -translate-x-1/2 border-t border-vellum bg-chalk">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="font-display text-lg font-medium text-ink">{BRAND.name}</span>
          <span className="font-sans text-[12px] text-graphite">
            Peer-to-peer over WebRTC · the signaling server never sees your files
          </span>
        </div>
      </footer>
    </main>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Pair",
    body: "One device shows a QR code; the other scans it, or types a short room code. That's the whole handshake.",
  },
  {
    n: "02",
    title: "Drop",
    body: "Pick any files. They stream directly between the two devices over an encrypted WebRTC channel.",
  },
  {
    n: "03",
    title: "Done",
    body: "Bytes go device-to-device — never through a server. On the same Wi-Fi it stays fully local.",
  },
];

/** Mask-rise reveal: content slides up from behind a clip. Reduced motion → fade. */
function Rise({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <m.span
        className="block will-change-transform"
        initial={reduce ? { opacity: 0 } : { y: "115%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      >
        {children}
      </m.span>
    </span>
  );
}

/** Same reveal, but a heading that fires when scrolled into view. */
function RiseHeading({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <h2 className={className}>
      <span className="block overflow-hidden pb-[0.08em]">
        <m.span
          className="block will-change-transform"
          initial={reduce ? { opacity: 0 } : { y: "120%" }}
          whileInView={reduce ? { opacity: 1 } : { y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.95, ease: EASE }}
        >
          {children}
        </m.span>
      </span>
    </h2>
  );
}

function StatPair({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span
        className={
          tone === "dark"
            ? "text-[11px] uppercase tracking-[0.18em] text-paper/50"
            : "text-[11px] uppercase tracking-[0.18em] text-ash"
        }
      >
        {label}
      </span>
      <span className={tone === "dark" ? "text-paper" : "text-ink"}>{value}</span>
    </span>
  );
}

function SectionLabel({
  left,
  right,
  tone = "light",
}: {
  left: string;
  right: string;
  tone?: "light" | "dark";
}) {
  const c = tone === "dark" ? "text-paper/50" : "text-ash";
  return (
    <div className={`mb-8 flex items-center justify-between font-sans text-[12px] uppercase tracking-[0.18em] ${c}`}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/** Step vignette: a serif numeral in a bone disc, wrapped by a slowly rotating dashed
 *  hairline ring, that fills to ink on hover. */
function Vignette({ numeral }: { numeral: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="group relative grid h-[184px] w-[184px] place-items-center">
      <m.svg
        viewBox="0 0 184 184"
        className="absolute inset-0 h-full w-full text-ink/25"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="92" cy="92" r="90" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 8" />
      </m.svg>
      <div className="grid h-[150px] w-[150px] place-items-center rounded-full border border-vellum bg-bone transition-colors duration-300 group-hover:border-ink group-hover:bg-ink">
        <span className="font-display text-[64px] font-medium leading-none text-ink/90 transition-colors duration-300 group-hover:text-paper">
          {numeral}
        </span>
      </div>
    </div>
  );
}

function Hexagon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2l8.66 5v10L12 22 3.34 17V7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
