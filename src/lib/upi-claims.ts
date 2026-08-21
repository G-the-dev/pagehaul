/**
 * Approved UPI payments, held in instance memory until the buyer's browser
 * collects them.
 *
 * There is no database anywhere in this product, and this does not add one:
 * an approval mints a self-contained signed token, parks it here keyed by
 * the payment reference, and the buyer's polling picks it up. If the poll
 * lands on a different serverless instance than the approval did, the map
 * misses — which is why every approval is ALSO emailed to the buyer, and
 * the dialog offers a paste box. Best case instant, worst case one paste.
 */

const TTL_MS = 60 * 60_000;
const MAX = 500;
const approved = new Map<string, { at: number; token: string }>();

export function parkApproval(ref: string, token: string): void {
  approved.set(ref, { at: Date.now(), token });
  while (approved.size > MAX) {
    const oldest = approved.keys().next().value;
    if (oldest === undefined) break;
    approved.delete(oldest);
  }
}

export function collectApproval(ref: string): string | null {
  const hit = approved.get(ref);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    approved.delete(ref);
    return null;
  }
  return hit.token;
}
