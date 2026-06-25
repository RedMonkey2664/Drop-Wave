/**
 * offline.mjs — run DropWave FULLY OFFLINE on the sending laptop.
 *
 * No internet, no cloud signaling, no STUN/TURN. Everything lives on this machine and
 * talks over the local Wi-Fi:
 *   • the Next.js app (served to other devices at https://<this-laptop-LAN-IP>:3000)
 *   • the signaling relay (wss://<this-laptop-LAN-IP>:8080) — handshake only, no files
 *
 * The browser auto-targets this laptop's signaling: the client derives the signaling URL
 * from the page's own host (see getSignalingUrl), so serving the app from the laptop IP
 * points signaling at the same laptop. We also force NEXT_PUBLIC_SIGNALING_URL empty so a
 * cloud value in .env.local can't override that during an offline session.
 *
 * Pair with "Local Wi-Fi" mode in the UI (it skips TURN; with no internet, ICE simply
 * uses host/mDNS candidates on the LAN — fast and self-contained).
 *
 * TLS: iPhones require a secure context (https/wss) for WebRTC. Drop a cert/key pair at
 * ./certificates/cert.pem + ./certificates/key.pem and both servers go secure. The
 * easiest offline-capable way to make one that the phone will trust:
 *     mkcert -install
 *     mkcert -cert-file certificates/cert.pem -key-file certificates/key.pem <LAN-IP> localhost
 * (install mkcert's root CA on the phone too). Without certs we fall back to http/ws,
 * which only works on http://localhost and some Android setups — iOS Safari will refuse.
 */

import { spawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

function lanIp() {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) return ni.address;
    }
  }
  return "localhost";
}

const ip = lanIp();
const WEB_PORT = process.env.PORT || "3000";
const SIG_PORT = process.env.SIGNALING_PORT || "8080";

const certDir = path.resolve("certificates");
const cert = path.join(certDir, "cert.pem");
const key = path.join(certDir, "key.pem");
const hasCerts = fs.existsSync(cert) && fs.existsSync(key);
const proto = hasCerts ? "https" : "http";

// ── banner ────────────────────────────────────────────────────────────────────
const line = "─".repeat(58);
console.log(`\n${line}`);
console.log("  DropWave — OFFLINE mode  (no internet required)");
console.log(line);
console.log(`  This laptop:     ${proto}://localhost:${WEB_PORT}`);
console.log(`  Other devices:   ${proto}://${ip}:${WEB_PORT}   (same Wi-Fi)`);
console.log(`  Signaling:       ${hasCerts ? "wss" : "ws"}://${ip}:${SIG_PORT}  (handshake only)`);
console.log(line);
console.log('  In the UI, turn ON "Local Wi-Fi" before pairing.');
if (!hasCerts) {
  console.log("\n  ⚠  No TLS cert in ./certificates — iPhones need HTTPS for WebRTC.");
  console.log("     Make one the phone will trust (works offline once mkcert is set up):");
  console.log("        mkcert -install");
  console.log(
    `        mkcert -cert-file certificates/cert.pem -key-file certificates/key.pem ${ip} localhost`
  );
  console.log("     then re-run: npm run offline\n");
}
console.log(`${line}\n`);

// ── spawn both servers, bound to the LAN ────────────────────────────────────────
const webEnv = { ...process.env, NEXT_PUBLIC_SIGNALING_URL: "" };
const sigEnv = { ...process.env, SIGNALING_PORT: String(SIG_PORT) };

let webArgs = `next dev -H 0.0.0.0 -p ${WEB_PORT}`;
if (hasCerts) {
  webArgs += ` --experimental-https --experimental-https-cert ${cert} --experimental-https-key ${key}`;
  sigEnv.SIGNALING_TLS_CERT = cert;
  sigEnv.SIGNALING_TLS_KEY = key;
}

const web = spawn(`npx ${webArgs}`, { stdio: "inherit", shell: true, env: webEnv });
const sig = spawn("node server/signaling/server.js", {
  stdio: "inherit",
  shell: true,
  env: sigEnv,
});

function shutdown() {
  web.kill();
  sig.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
web.on("exit", shutdown);
sig.on("exit", shutdown);
