"use client";

/**
 * Registers the service worker (public/sw.js) for offline app-shell support. Kept as a
 * tiny client component so the root layout can stay a server component. Registration is
 * best-effort and silent on failure (e.g. unsupported browsers, http dev origins).
 */

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell simply won't be available; the app still works online */
    });
  }, []);
  return null;
}
