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
    // The optimizer is off on purpose. A scanner's thumbnails are other
    // sites' never-seen-before URLs, so nearly every one was a billable
    // cache miss — the whole monthly transformation allowance disappeared
    // into a few days of scanning. Tiles load straight from their origins;
    // the smallest-known-variant selection and the browser's cache do the
    // work the optimizer was doing, for free.
    unoptimized: true,
  },
};

export default nextConfig;
