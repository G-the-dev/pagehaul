/**
 * Who is allowed how much, remembered in the browser.
 *
 * There are no accounts, so the browser's storage is the ledger: which sites
 * this person has deep-scanned free, and the license token a purchase minted.
 * It is honest bookkeeping rather than a lock — someone clearing storage gets
 * a fresh allowance, and the server keeps its own rough count by address to
 * keep that from being a habit. The expensive thing being protected is
 * browser time on our compute; the design tab and 3D files are the value
 * that makes upgrading worth it.
 */

export const FREE_DEEP_SITES = 2;
export const PRO_PRICE_INR = 99;
export const PACK_PRICE_INR = 99;
export const PACK_SCANS = 25;

const HOSTS_KEY = "ph-deep-hosts";
const LICENSE_KEY = "ph-license";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Hosts this browser has deep-scanned on the free plan. */
export function usedDeepHosts(): string[] {
  const v = read<unknown>(HOSTS_KEY, []);
  return Array.isArray(v) ? v.filter((h): h is string => typeof h === "string") : [];
}

/**
 * Counts a site against the free allowance. A rescan of a site already on
 * the list is free — heavy pages ask to be scanned again, and charging the
 * retry would punish exactly the person the retry exists for.
 */
export function recordDeepHost(host: string): void {
  if (typeof window === "undefined") return;
  const hosts = usedDeepHosts();
  if (hosts.includes(host)) return;
  try {
    window.localStorage.setItem(HOSTS_KEY, JSON.stringify([...hosts, host].slice(-24)));
  } catch {
    /* storage full or blocked — the server's count still stands */
  }
}

export function deepScansLeft(): number {
  return Math.max(0, FREE_DEEP_SITES - usedDeepHosts().length);
}

/** Whether this host can be deep-scanned free: new within allowance, or a retry. */
export function deepAllowed(host: string): boolean {
  const hosts = usedDeepHosts();
  return hosts.includes(host) || hosts.length < FREE_DEEP_SITES;
}

/** The license token a purchase minted, if any. The server verifies it. */
export function licenseToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LICENSE_KEY);
  } catch {
    return null;
  }
}

export function storeLicense(token: string): void {
  try {
    window.localStorage.setItem(LICENSE_KEY, token);
  } catch {
    /* nothing to do — the purchase response also shows the token to copy */
  }
}

/**
 * Paid, as far as this browser knows. The client uses this only to decide
 * what to draw — locks, counters, buttons. The server re-verifies the token
 * on every deep scan, so a hand-written "true" here unlocks nothing real.
 */
export function isPaid(): boolean {
  return !!licenseToken();
}
