"use client";

/**
 * UnsupportedNotice — calm, helpful fallback when the browser can't do WebRTC data
 * channels (DESIGN.md §8: "never alarming red walls — explain the fix").
 */

import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function UnsupportedNotice() {
  return (
    <Card className="max-w-md p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-warning/40 text-warning">
        <Compass size={22} />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold text-text-primary">
        This browser can’t open a direct connection
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        DropWave needs WebRTC data channels, which aren’t available here. Open this page
        in the latest <strong>Chrome, Edge, Safari, or Firefox</strong> — on both
        devices — and it’ll work.
      </p>
      <Link href="/" className="mt-6 inline-block">
        <Button variant="secondary">Back to start</Button>
      </Link>
    </Card>
  );
}
