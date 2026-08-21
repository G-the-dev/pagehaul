/**
 * Licenses are self-contained signed tokens, because there is no database.
 *
 * A purchase mints `v1.<base64url payload>.<hmac>`; the payload names the
 * plan and its expiry (subscriptions) or remaining-scan shape (packs are
 * re-minted with a decremented count on each use — v1 keeps packs simple:
 * a pack token carries an expiry far in the future and the scan budget is
 * tracked alongside the free counter). Verification is one HMAC — no
 * lookup, no state, nothing to leak.
 *
 * The signing secret lives in the environment. Without it set, no token
 * verifies, which fails closed: nobody is paid until payments exist.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface LicensePayload {
  /** "pro" (subscription) or "pack" (one-time scan bundle). */
  plan: "pro" | "pack";
  /** Unix ms after which the token no longer verifies. */
  exp: number;
  /** Razorpay payment id, for support lookups. */
  ref?: string;
}

function secret(): string | null {
  return process.env.PH_LICENSE_SECRET || null;
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

export function mintLicense(payload: LicensePayload): string | null {
  const key = secret();
  if (!key) return null;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `v1.${body}.${sign(body, key)}`;
}

export function verifyLicense(token: string | null): LicensePayload | null {
  const key = secret();
  if (!key || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, mac] = parts;
  const expected = sign(body, key);
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LicensePayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.plan !== "pro" && payload.plan !== "pack") return null;
    return payload;
  } catch {
    return null;
  }
}
