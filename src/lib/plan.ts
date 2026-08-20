/**
 * Who is allowed how much, remembered in the browser.
 *
 * There are no accounts, so the browser's storage is the ledger: how many
 * deep scans this person has run free, and the license token a purchase
 * minted. It is honest bookkeeping rather than a lock. Someone clearing
 * storage gets a fresh allowance, and the server keeps its own rough count
 * by address to keep that from being a habit. The expensive thing being
 * protected is browser time on our compute; the design system, audio,
 * screenshots and 3D files are the value that makes upgrading worth it.
 */

export const FREE_DEEP_SCANS = 2;
export const PRO_PRICE_INR = 249;
export const PACK_PRICE_INR = 99;
export const PACK_SCANS = 5;

/** Kinds a free account can see but not open or download. */
export const LOCKED_KINDS = ["model", "audio", "screenshot"] as const;

const USED_KEY = "ph-deep-used";
const LICENSE_KEY = "ph-license";

export function usedDeepScans(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(window.localStorage.getItem(USED_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Counts one deep scan. Every deep scan counts, rescans included. */
export function recordDeepScan(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USED_KEY, String(usedDeepScans() + 1));
  } catch {
    /* storage full or blocked; the server's count still stands */
  }
}

export function deepScansLeft(): number {
  return Math.max(0, FREE_DEEP_SCANS - usedDeepScans());
}

export function deepAllowed(): boolean {
  return deepScansLeft() > 0;
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
    /* nothing to do; the purchase response also shows the token to copy */
  }
}

/** The token's payload, read without verifying: display and counting only. */
export function licensePlan(): "pro" | "pack" | null {
  const t = licenseToken();
  if (!t) return null;
  try {
    const body = t.split(".")[1] ?? "";
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as { plan?: string; exp?: number };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload.plan === "pack" ? "pack" : payload.plan === "pro" ? "pro" : null;
  } catch {
    return null;
  }
}

const PACK_USED_KEY = "ph-pack-used";

export function packScansUsed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(window.localStorage.getItem(PACK_USED_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function recordPackScan(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PACK_USED_KEY, String(packScansUsed() + 1));
  } catch {
    /* nothing to do */
  }
}

export function packScansLeft(): number {
  return Math.max(0, PACK_SCANS - packScansUsed());
}

/**
 * Paid, as far as this browser knows. A pack is paid only while it still
 * has scans in it. The client uses this only to decide what to draw; the
 * server re-verifies the token on every deep scan, so a hand-written
 * "true" here unlocks nothing real.
 */
export function isPaid(): boolean {
  const plan = licensePlan();
  if (!plan) return false;
  if (plan === "pack") return packScansLeft() > 0;
  return true;
}
