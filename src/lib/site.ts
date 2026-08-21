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
   * This address carries everything, including takedown notices. It is also
   * the default destination for messages sent through the contact form.
   */
  contactEmail: "pagehaul.contact@gmail.com",

  repo: "https://github.com/G-the-dev/pagehaul",

  /** Shown on the legal pages. Update when you change the wording. */
  legalUpdated: "20 August 2026",

  /** Must match DOWNLOAD_TTL_MINUTES in src/config/limits.ts. */
  retentionMinutes: 5,

  /**
   * How long a set of results stays on screen, in minutes.
   *
   * Longer than the server keeps anything, on purpose. Nothing here is stored
   * server side to begin with — the list is addresses, and your browser fetches
   * each file from the site it came from — so this window is about not leaving
   * somebody else's page contents sitting in a tab indefinitely.
   */
  resultsMinutes: 7,
} as const;

export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;
