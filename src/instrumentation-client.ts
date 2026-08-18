import posthog from "posthog-js";

/**
 * PostHog, initialised before hydration on every page.
 *
 * This is the product's eyes: web analytics, session replay, and the few
 * events the app captures by hand (a scan, a download). The key is the
 * project's public token — it ships to every browser by design, so the env
 * var is a convenience for pointing at another project, not a secret.
 *
 * Events go through /ingest on our own origin (see next.config.ts) rather
 * than straight to PostHog's domain, which content blockers filter by name.
 */
const KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  "phc_mmFSBAukT7rGfahjh2Nf89B8BSVLjPqhnWVKqkYrDR5c";

if (KEY.startsWith("phc_")) {
  posthog.init(KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    // The dated defaults bundle: history-change pageviews for an SPA,
    // pageleave, and the current sane baseline.
    defaults: "2025-05-24",
    capture_exceptions: true,
  });
}
