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
export const PRO_PRICE_USD = 2.99;
export const PACK_PRICE_USD = 1.49;
export const PACK_SCANS = 5;
/** Kept for the dormant UPI flow; the live checkout is Dodo, in dollars. */
export const PRO_PRICE_INR = 249;
export const PACK_PRICE_INR = 99;

/** Kinds a free account can see but not open or download. */
export const LOCKED_KINDS = ["model", "audio", "screenshot"] as const;

const USED_KEY = "ph-deep-used";
const LICENSE_KEY = "ph-license";
const NEXT_KEY = "ph-license-next";

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
    promoteIfDue();
    const t = window.localStorage.getItem(LICENSE_KEY);
    const payload = readPayload(t);
    if (!payload || (payload.nbf && payload.nbf > Date.now())) return null;
    return t;
  } catch {
    return null;
  }
}

const PACK_BONUS_KEY = "ph-pack-bonus";

export function storeLicense(token: string): void {
  try {
    const prev = readPayload(window.localStorage.getItem(LICENSE_KEY));
    const next = readPayload(token);
    // The same token arriving again (the unlock link opened twice) changes
    // nothing worth resetting.
    if (prev && next && prev.ref && prev.ref === next.ref) {
      window.localStorage.setItem(LICENSE_KEY, token);
      return;
    }
    // A purchase whose start date is still ahead waits its turn in the
    // queue slot rather than displacing what is live now.
    if (next?.nbf && next.nbf > Date.now()) {
      window.localStorage.setItem(
        NEXT_KEY,
        JSON.stringify({ token, fresh: true }),
      );
      return;
    }
    // Pro arriving over a pack with scans still in it: the pack is stashed,
    // counters untouched, and resumes when Pro ends. Paid scans do not
    // vanish because something bigger was bought.
    if (
      prev?.plan === "pack" &&
      next?.plan === "pro" &&
      packScansLeft() > 0
    ) {
      const oldToken = window.localStorage.getItem(LICENSE_KEY);
      if (oldToken) {
        window.localStorage.setItem(
          NEXT_KEY,
          JSON.stringify({ token: oldToken, fresh: false }),
        );
      }
      window.localStorage.setItem(LICENSE_KEY, token);
      window.localStorage.removeItem("ph-renewal-sent");
      return;
    }
    // A refill carries the old pack's remaining scans forward.
    const carry =
      prev?.plan === "pack" && next?.plan === "pack" ? packScansLeft() : 0;
    window.localStorage.setItem(LICENSE_KEY, token);
    window.localStorage.setItem(PACK_BONUS_KEY, String(carry));
    window.localStorage.removeItem("ph-pack-used");
    window.localStorage.removeItem("ph-lowpack-sent");
    window.localStorage.removeItem("ph-renewal-sent");
  } catch {
    /* nothing to do; the unlock dialog also shows the link to copy */
  }
}

/** When a stored token (live or queued) begins, for the dialog's copy. */
export function tokenStartsAt(token: string): number | null {
  try {
    const body = token.split(".")[1] ?? "";
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as { nbf?: number };
    return typeof payload.nbf === "number" ? payload.nbf : null;
  } catch {
    return null;
  }
}

function packBonus(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number(window.localStorage.getItem(PACK_BONUS_KEY) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** The token's payload, read without verifying: display and counting only. */
function readPayload(
  t: string | null,
): {
  plan: "pro" | "pack";
  exp: number;
  nbf?: number;
  ref?: string;
  email?: string;
} | null {
  if (!t) return null;
  try {
    const body = t.split(".")[1] ?? "";
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as {
      plan?: string;
      exp?: number;
      nbf?: number;
      ref?: string;
      email?: string;
    };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.plan !== "pro" && payload.plan !== "pack") return null;
    return {
      plan: payload.plan,
      exp: payload.exp,
      nbf: typeof payload.nbf === "number" ? payload.nbf : undefined,
      ref: payload.ref,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The token whose turn it is. If the current one lapsed and a queued
 * purchase's start date has arrived, the queue steps forward: the waiting
 * token becomes the license, its ledgers reset if it was a fresh purchase
 * rather than a stashed remainder.
 */
function promoteIfDue(): void {
  if (typeof window === "undefined") return;
  try {
    const cur = readPayload(window.localStorage.getItem(LICENSE_KEY));
    if (cur && (!cur.nbf || cur.nbf <= Date.now())) return;
    const rawNext = window.localStorage.getItem(NEXT_KEY);
    if (!rawNext) return;
    const parsed = JSON.parse(rawNext) as { token?: string; fresh?: boolean };
    const next = readPayload(parsed.token ?? null);
    if (!next) {
      window.localStorage.removeItem(NEXT_KEY);
      return;
    }
    if (next.nbf && next.nbf > Date.now()) return;
    window.localStorage.setItem(LICENSE_KEY, parsed.token!);
    window.localStorage.removeItem(NEXT_KEY);
    if (parsed.fresh) {
      window.localStorage.removeItem("ph-pack-used");
      window.localStorage.setItem(PACK_BONUS_KEY, "0");
      window.localStorage.removeItem("ph-lowpack-sent");
      window.localStorage.removeItem("ph-renewal-sent");
    }
  } catch {
    /* storage blocked */
  }
}

/** Whether a purchase is waiting behind the current plan. */
export function queuedPlan(): "pro" | "pack" | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return readPayload(parsed.token ?? null)?.plan ?? null;
  } catch {
    return null;
  }
}

export function licensePlan(): "pro" | "pack" | null {
  return readPayload(licenseToken())?.plan ?? null;
}

/** When the current plan runs out, in unix ms; null when there is none. */
export function planExpiry(): number | null {
  return readPayload(licenseToken())?.exp ?? null;
}

/** The email the current plan was bought with, for showing whose it is. */
export function licenseEmail(): string | null {
  return readPayload(licenseToken())?.email ?? null;
}

/**
 * The raw stored token when it is an expired Pro that names a
 * subscription: the one case worth sending to the refresh endpoint,
 * where the subscription may still be paying for a fresh month.
 */
export function lapsedSubscriptionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const t = window.localStorage.getItem(LICENSE_KEY);
    if (!t) return null;
    if (readPayload(t)) return null; // still live; nothing to refresh
    const body = t.split(".")[1] ?? "";
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(pad)) as { plan?: string; sub?: string };
    return payload.plan === "pro" && typeof payload.sub === "string" ? t : null;
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
  return Math.max(0, PACK_SCANS + packBonus() - packScansUsed());
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
