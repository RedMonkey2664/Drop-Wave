"use client";

/**
 * LandingNav — minimal editorial header for the "Structured" restyle: a circled
 * monogram top-left, ghost text links, and a single filled pill CTA. No menu chrome,
 * no shadows. A hairline vellum rule fades in once you scroll so the bar separates
 * cleanly from the putty canvas. The in-page anchors ("How it works", "See files
 * move", "Private by design") smooth-scroll to their sections.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion as m, useReducedMotion } from "framer-motion";
import { MonogramLogo } from "@/components/ui/MonogramLogo";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/theme/tokens";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "see-files-move", label: "See files move" },
  { id: "private", label: "Private by design" },
];

export function LandingNav() {
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => !!el
    );
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <m.header
      initial={reduce ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50"
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-6 py-5 text-ink">
        {/* monogram + name */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
          aria-label={`${BRAND.name} home`}
        >
          <MonogramLogo size={30} />
          <span className="font-display text-base font-medium tracking-tight">
            {BRAND.name}
          </span>
        </Link>

        {/* center links — ghost text, underline on active/hover */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="Page sections">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              className={cn(
                "relative font-sans text-[13px] underline-offset-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40",
                active === l.id
                  ? "text-ink underline"
                  : "text-graphite hover:text-ink hover:underline"
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link href="/receive" className="hidden sm:block">
            <Button variant="ghost" size="md">
              Receive
            </Button>
          </Link>
          <Link href="/send">
            <Button size="md">Send a file</Button>
          </Link>
        </div>
      </div>

      {/* hairline rule + faint canvas wash once scrolled */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 border-b border-vellum bg-putty/85 backdrop-blur-sm transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0"
        )}
      />
    </m.header>
  );
}
