/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The service worker and manifest live in /public and are registered client-side
  // (see components/pwa/ServiceWorkerRegistrar). We intentionally avoid a heavy PWA
  // plugin to keep the build transparent and the offline shell easy to reason about.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
