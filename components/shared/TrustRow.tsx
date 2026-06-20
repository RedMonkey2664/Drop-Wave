"use client";

/**
 * TrustRow — the trust signals beneath the hero (DESIGN.md "Landing"). These are
 * honest claims only: the connection IS encrypted (WebRTC DataChannels use DTLS by
 * default), it DOES work without accounts, and on the same Wi-Fi it stays local. We do
 * not imply LAN auto-discovery — pairing is via QR/code (see honesty note on landing).
 */

import { motion as m } from "framer-motion";
import { Lock, UserX, WifiOff, MonitorSmartphone } from "lucide-react";
import { reveal } from "@/lib/theme/tokens";

const items = [
  { icon: Lock, label: "End-to-end encrypted" },
  { icon: UserX, label: "No accounts" },
  { icon: WifiOff, label: "Works offline on Wi-Fi" },
  { icon: MonitorSmartphone, label: "iPhone ↔ Windows" },
];

export function TrustRow() {
  return (
    <m.ul
      variants={reveal.container}
      initial="hidden"
      animate="show"
      className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
    >
      {items.map(({ icon: Icon, label }) => (
        <m.li
          key={label}
          variants={reveal.item}
          className="flex items-center gap-2 text-sm text-text-secondary"
        >
          <Icon size={15} className="text-aqua" />
          {label}
        </m.li>
      ))}
    </m.ul>
  );
}
