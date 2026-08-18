import posthog from "posthog-js";

/**
 * One safe door to analytics for every component.
 *
 * Capture quietly does nothing when PostHog is not configured, and a failure
 * inside analytics must never take a feature down with it — the product
 * works identically with the numbers on or off.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    if (posthog.__loaded) posthog.capture(event, props);
  } catch {
    /* analytics must never break the app */
  }
}
