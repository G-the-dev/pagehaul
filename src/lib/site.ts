/**
 * Everything about the site that appears in more than one place.
 *
 * The legal pages in particular repeat a contact address and a date. Keeping
 * them here means changing one line rather than hunting through four files and
 * leaving one stale.
 */

export const SITE = {
  name: "pagehaul",
  tagline: "Every asset on any page, one click away.",

  /**
   * CHANGE THIS BEFORE LAUNCH.
   *
   * A takedown notice has to reach a real inbox or the policy that promises to
   * answer one is worthless. Use an address on your own domain rather than a
   * personal one, so it can be handed over or filtered later.
   */
  contactEmail: "hello@pagehaul.com",
  abuseEmail: "abuse@pagehaul.com",

  repo: "https://github.com/G-the-dev/pagehaul",

  /** Shown on the legal pages. Update when you change the wording. */
  legalUpdated: "15 August 2026",

  /** Must match DOWNLOAD_TTL_MINUTES in src/config/limits.ts. */
  retentionMinutes: 5,
} as const;

export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;
