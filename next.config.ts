import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chromium ships a binary that must not be bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // PostHog calls go through our own origin, because content blockers filter
  // the posthog domain by name and the analytics would otherwise undercount
  // exactly the technical audience this site has.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // PostHog's API paths end in a trailing slash; a redirect would break them.
  skipTrailingSlashRedirect: true,
  // Ship source maps, so an error report carries a component name instead of
  // "sq in chunk 20z8gmkna73og.js, sourcemap not found". The code is public
  // on GitHub already; the maps give away nothing that isn't.
  productionBrowserSourceMaps: true,
  // The chromium binary ships as .br archives that tracing does not pick up on
  // its own, so the deep-scan route has to include them explicitly.
  outputFileTracingIncludes: {
    // Both routes drive the headless browser, so both need its binary traced
    // into their bundle.
    "/api/scan": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/poster": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  images: {
    // The scanner previews images from any site the user pastes, so the
    // optimizer has to accept any https host. It fetches each thumbnail once,
    // resizes it, re-encodes to WebP/AVIF, and serves it cached — which is
    // what stops hundreds of raw cross-origin requests from hammering origins
    // (the blank tiles) and what makes a scrolled-back tile instant instead of
    // a fresh fetch.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/webp"],
    // Next 16 rejects any quality not listed here.
    qualities: [70],
    // A tile is ~200px; these are the widths we actually request.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [420, 640, 828],
    // Cache an optimized thumbnail for a day at the edge.
    minimumCacheTTL: 86400,
  },
};

export default nextConfig;
