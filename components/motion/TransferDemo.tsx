"use client";

/**
 * TransferDemo — the "how it works" animation, restyled flat + monochrome for the
 * Structured "ink room" (a full-bleed black section). Two devices, an encrypted P2P
 * channel between them, and file packets that fly device-to-device along a curved path
 * on a loop. Paper/white strokes on black — no color, no glow gradients.
 *
 * One responsive SVG animated purely on transform/opacity. Reduced motion renders a
 * clean static snapshot (devices, channel, one packet mid-flight).
 */

import { motion as m, useReducedMotion } from "framer-motion";

const VB_W = 760;
const VB_H = 360;

const P0: [number, number] = [224, 150];
const P1: [number, number] = [380, 34];
const P2: [number, number] = [536, 150];

function quad(t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
    u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
  ];
}

const STEPS = 22;
const XS: number[] = [];
const YS: number[] = [];
const OPS: number[] = [];
const SCALES: number[] = [];
for (let i = 0; i <= STEPS; i++) {
  const t = i / STEPS;
  const [x, y] = quad(t);
  XS.push(x);
  YS.push(y);
  const env = t < 0.12 ? t / 0.12 : t > 0.88 ? (1 - t) / 0.12 : 1;
  OPS.push(Math.max(0, Math.min(1, env)));
  SCALES.push(0.6 + 0.4 * Math.max(0, Math.min(1, env)));
}

const PATH_D = `M${P0[0]},${P0[1]} Q${P1[0]},${P1[1]} ${P2[0]},${P2[1]}`;
const PACKET_DUR = 2.8;
const PACKETS = [0, 1, 2];

function Packet({ delay }: { delay: number }) {
  return (
    <m.g
      initial={{ x: P0[0], y: P0[1], opacity: 0, scale: 0.6 }}
      animate={{ x: XS, y: YS, opacity: OPS, scale: SCALES }}
      transition={{ duration: PACKET_DUR, ease: "linear", repeat: Infinity, delay }}
    >
      {/* paper file chip with ink rules */}
      <rect x={-13} y={-15} width={26} height={30} rx={4} fill="#ffffff" />
      <path d="M5 -15 L13 -7 L5 -7 Z" fill="#c4c3b6" />
      <rect x={-7} y={-2} width={14} height={2} rx={1} fill="#000000" fillOpacity="0.55" />
      <rect x={-7} y={4} width={14} height={2} rx={1} fill="#000000" fillOpacity="0.55" />
      <rect x={-7} y={10} width={9} height={2} rx={1} fill="#000000" fillOpacity="0.55" />
    </m.g>
  );
}

function Device({ x, variant }: { x: number; variant: "sender" | "receiver" }) {
  return (
    <g transform={`translate(${x},0)`}>
      <rect x={0} y={95} width={150} height={210} rx={12} fill="#0c0c0c" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1.5" />
      <rect x={13} y={112} width={124} height={176} rx={8} fill="#000000" stroke="#ffffff" strokeOpacity="0.14" />
      <rect x={58} y={104} width={34} height={5} rx={2.5} fill="#ffffff" fillOpacity="0.2" />
      {variant === "sender" ? <SenderScreen /> : <ReceiverScreen />}
    </g>
  );
}

function SenderScreen() {
  const cells = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [2, 1],
    [0, 2], [1, 2], [2, 2],
  ];
  const size = 26;
  const gap = 6;
  const gridW = 3 * size + 2 * gap;
  const ox = 75 - gridW / 2;
  const oy = 200 - gridW / 2;
  return (
    <g>
      {cells.map(([cx, cy], i) => (
        <m.rect
          key={i}
          x={ox + cx * (size + gap)}
          y={oy + cy * (size + gap)}
          width={size}
          height={size}
          rx={3}
          fill="#ffffff"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.95, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, delay: (i % 4) * 0.18, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

function ReceiverScreen() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <m.g
          key={i}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 1, 1, 0.3] }}
          transition={{ duration: PACKET_DUR, repeat: Infinity, delay: i * (PACKET_DUR / 3), ease: "easeInOut" }}
        >
          <rect x={28} y={150 + i * 34} width={94} height={24} rx={4} fill="#ffffff" fillOpacity="0.06" stroke="#ffffff" strokeOpacity="0.2" />
          <circle cx={42} cy={162 + i * 34} r={6} fill="#ffffff" />
          <rect x={54} y={158 + i * 34} width={56} height={4} rx={2} fill="#ffffff" fillOpacity="0.4" />
        </m.g>
      ))}
    </g>
  );
}

export function TransferDemo() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        role="img"
        aria-label="Animation: a file flies directly between two devices over an encrypted peer-to-peer connection"
      >
        {/* broadcasting ring around the sender */}
        {!reduce && (
          <m.circle
            cx={155}
            cy={200}
            r={70}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.4, opacity: [0, 0.4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
        )}

        {/* the encrypted P2P channel */}
        <path d={PATH_D} fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="3" />
        <m.path
          d={PATH_D}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeDasharray="2 10"
          strokeLinecap="round"
          animate={reduce ? undefined : { strokeDashoffset: [0, -48] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />

        {/* channel label */}
        <g transform={`translate(${380}, 96)`}>
          <rect x={-82} y={-15} width={164} height={28} rx={14} fill="#000000" stroke="#ffffff" strokeOpacity="0.25" />
          <circle cx={-62} cy={0} r={4} fill="#ffffff" />
          <text x={-50} y={4} fill="#ffffff" fillOpacity="0.75" fontSize="13" fontFamily="var(--font-sans), sans-serif">
            encrypted · P2P
          </text>
        </g>

        <Device x={80} variant="sender" />
        <Device x={530} variant="receiver" />

        <text x={155} y={332} textAnchor="middle" fill="#ffffff" fillOpacity="0.5" fontSize="14" fontFamily="var(--font-sans), sans-serif">
          Your phone
        </text>
        <text x={605} y={332} textAnchor="middle" fill="#ffffff" fillOpacity="0.5" fontSize="14" fontFamily="var(--font-sans), sans-serif">
          Any device
        </text>

        {reduce ? (
          <g transform={`translate(${quad(0.5)[0]},${quad(0.5)[1]})`}>
            <rect x={-13} y={-15} width={26} height={30} rx={4} fill="#ffffff" />
          </g>
        ) : (
          PACKETS.map((i) => <Packet key={i} delay={(i * PACKET_DUR) / PACKETS.length} />)
        )}
      </svg>
    </div>
  );
}
