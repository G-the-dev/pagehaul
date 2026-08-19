/**
 * The addresses this browser has scanned, kept across refreshes.
 *
 * Stored in localStorage, so it is this person's own list on their own machine
 * and never leaves it — nothing about a scan is sent anywhere to build this, it
 * is written locally after a scan finishes. Newest first, deduped, capped, so
 * the row stays a handful of chips rather than a growing wall.
 */

const KEY = "pagehaul.recent";
const MAX = 6;

export interface Recent {
  /** The address to scan again, exactly as it was scanned. */
  url: string;
  /** A short label for the chip: the host, and a hint of the path if it has one. */
  label: string;
}

/** Turns a scanned URL into a short, readable chip label. */
function labelFor(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    if (!path) return host;
    // One trailing path segment is enough of a hint without bloating the chip.
    const last = path.split("/").filter(Boolean).pop() ?? "";
    return last && last.length <= 14 ? `${host}/${last}` : host;
  } catch {
    return url.replace(/^https?:\/\//, "").slice(0, 24);
  }
}

export function getRecent(): Recent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.url === "string")
      .slice(0, MAX)
      .map((r) => ({ url: r.url, label: typeof r.label === "string" ? r.label : labelFor(r.url) }));
  } catch {
    return [];
  }
}

/**
 * One site, one chip. "likova.space", "https://likova.space" and
 * "likova.space/" are the same place three ways, and exact-string matching
 * let all three stand in the row. The key is the normalised host and path.
 */
function keyFor(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Records a scanned address at the front of the list and returns the new list. */
export function addRecent(url: string): Recent[] {
  const entry: Recent = { url, label: labelFor(url) };
  const key = keyFor(url);
  const rest = getRecent().filter((r) => keyFor(r.url) !== key);
  const next = [entry, ...rest].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be refused (private mode). The row just will not persist.
  }
  return next;
}

export function removeRecent(url: string): Recent[] {
  const next = getRecent().filter((r) => r.url !== url);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
