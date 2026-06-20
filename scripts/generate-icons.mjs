/**
 * generate-icons.mjs — produce the PWA/tab icons with zero dependencies.
 *
 * Rasterizes the DropWave "Structured" tab mark: a circled "D" monogram in ink on the
 * warm putty canvas (mirrors public/icons/icon.svg), encoded as PNG via Node's built-in
 * zlib. Run: `node scripts/generate-icons.mjs` → public/icons/icon-{192,512}.png.
 *
 * Geometry is defined in a 512-unit space and scaled to each output size.
 */

import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

const PUTTY = [0xc4, 0xc3, 0xb6];
const INK = [0x00, 0x00, 0x00];

const lerp = (a, b, t) => a + (b - a) * t;
const compositeOver = (dst, src, a) => [lerp(dst[0], src[0], a), lerp(dst[1], src[1], a), lerp(dst[2], src[2], a)];

// All tests are in 512-unit space.
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const hw = (x1 - x0) / 2;
  const hh = (y1 - y0) / 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return d <= 0;
}

/** Supersampled coverage (0..1) of a 512-space predicate at output pixel (px,py). */
function cover(px, py, N, test) {
  const s = N / 512;
  let hits = 0;
  for (let sy = 0; sy < 3; sy++)
    for (let sx = 0; sx < 3; sx++) {
      const x = (px + (sx + 0.5) / 3) / s;
      const y = (py + (sy + 0.5) / 3) / s;
      if (test(x, y)) hits++;
    }
  return hits / 9;
}

const bgTest = (x, y) => inRoundedRect(x, y, 0, 0, 512, 512, 112);
const ringTest = (x, y) => Math.abs(Math.hypot(x - 256, y - 256) - 200) <= 7;
const stemTest = (x, y) => inRoundedRect(x, y, 155, 120, 205, 392, 24);
const bowlTest = (x, y) => {
  if (x < 205) return false;
  const r = Math.hypot(x - 205, y - 256);
  return r >= 101 && r <= 151;
};

function renderRGBA(N) {
  const buf = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const bg = cover(x, y, N, bgTest);
      let rgb = PUTTY.slice();
      const ink = Math.max(
        cover(x, y, N, ringTest),
        cover(x, y, N, stemTest),
        cover(x, y, N, bowlTest)
      );
      if (ink > 0) rgb = compositeOver(rgb, INK, ink);

      const i = (y * N + x) * 4;
      buf[i] = Math.round(rgb[0]);
      buf[i + 1] = Math.round(rgb[1]);
      buf[i + 2] = Math.round(rgb[2]);
      buf[i + 3] = Math.round(255 * bg);
    }
  }
  return buf;
}

// ── minimal PNG encoder (RGBA, 8-bit) ─────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function encodePNG(rgba, N) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = N * 4;
  const raw = Buffer.alloc((stride + 1) * N);
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

for (const N of [192, 512]) {
  const png = encodePNG(renderRGBA(N), N);
  const file = join(OUT_DIR, `icon-${N}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
