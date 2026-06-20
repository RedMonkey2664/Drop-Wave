"use client";

import Link from "next/link";
import { MonogramLogo } from "@/components/ui/MonogramLogo";
import { Wordmark } from "@/components/ui/Wordmark";
import { BRAND } from "@/lib/theme/tokens";

export function Header() {
  return (
    <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between px-6 py-5 text-ink">
      <Link
        href="/"
        className="group flex items-center gap-2.5 rounded-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
        aria-label={`${BRAND.name} home`}
      >
        <MonogramLogo size={28} />
        <Wordmark className="text-lg" />
      </Link>
      <span className="hidden font-sans text-[12px] uppercase tracking-[0.18em] text-graphite sm:block">
        {BRAND.tagline}
      </span>
    </header>
  );
}
