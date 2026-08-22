/**
 * Dodo Payments, the merchant of record.
 *
 * Dodo hosts the checkout, charges the card or UPI, handles tax and
 * invoices, and sends the buyer back with a payment or subscription id in
 * the query string. Our job shrinks to verifying that id against their
 * API and minting the unlock token. The static checkout links need no
 * server call at all, which is why the product ids live in code: they are
 * public, they appear in every checkout URL.
 */

export const DODO_PRODUCTS = {
  pro: "pdt_0NlvN5iifcrI1ZiDJ9NC6",
  pack: "pdt_0NlvSzHVzs3pp6Hic6r0W",
} as const;

export const DODO_CHECKOUT_BASE = "https://checkout.dodopayments.com/buy";

/**
 * Flip to true the day Dodo finishes verifying the account. Until then the
 * buy buttons say payments are opening shortly instead of marching buyers
 * into a checkout that cannot take their money.
 */
export const DODO_CHECKOUT_READY = false;

const API = "https://live.dodopayments.com";

async function dodoGet(path: string): Promise<Record<string, unknown> | null> {
  const key = process.env.DODO_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error("dodo api:", path, res.status);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (e) {
    console.error("dodo api failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface VerifiedPurchase {
  plan: "pro" | "pack";
  email: string;
  /** The payment or subscription id, the support handle. */
  ref: string;
  /** Present for subscriptions, so an expired token can be refreshed. */
  sub?: string;
}

/** A one-time payment that genuinely succeeded for one of our products. */
export async function verifyPayment(
  paymentId: string,
): Promise<VerifiedPurchase | null> {
  const p = await dodoGet(`/payments/${encodeURIComponent(paymentId)}`);
  if (!p || p.status !== "succeeded") return null;
  const cart = (p.product_cart ?? []) as { product_id?: string }[];
  const isPack = cart.some((c) => c.product_id === DODO_PRODUCTS.pack);
  const isPro = cart.some((c) => c.product_id === DODO_PRODUCTS.pro);
  if (!isPack && !isPro) return null;
  const email = ((p.customer as { email?: string })?.email ?? "").toLowerCase();
  if (!email) return null;
  return { plan: isPack ? "pack" : "pro", email, ref: paymentId };
}

/** A subscription that is live right now. */
export async function verifySubscription(
  subscriptionId: string,
): Promise<VerifiedPurchase | null> {
  const s = await dodoGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  if (!s) return null;
  const status = String(s.status ?? "");
  if (status !== "active" && status !== "trialing") return null;
  if (s.product_id !== DODO_PRODUCTS.pro) return null;
  const email = ((s.customer as { email?: string })?.email ?? "").toLowerCase();
  if (!email) return null;
  return { plan: "pro", email, ref: subscriptionId, sub: subscriptionId };
}
