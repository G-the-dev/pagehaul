import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chromium ships a binary that must not be bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // The chromium binary ships as .br archives that tracing does not pick up on
  // its own, so the deep-scan route has to include them explicitly.
  outputFileTracingIncludes: {
    "/api/scan": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  /* config options here */
};

export default nextConfig;
