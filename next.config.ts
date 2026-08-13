import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chromium ships a binary that must not be bundled.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  /* config options here */
};

export default nextConfig;
