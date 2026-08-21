import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { mintLicense } from "@/lib/license";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay checkout, in two halves.
 *
 * POST /api/checkout        { plan: "pro" | "pack" }
 *   → creates a Razorpay order and returns what the checkout widget needs.
 * POST /api/checkout?verify { plan, razorpay_order_id, razorpay_payment_id,
 *                             razorpay_signature }
 *   → verifies Razorpay's signature and mints the license token the browser
 *     stores. No accounts, no database: the token IS the entitlement.
 *
 * Until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / PH_LICENSE_SECRET exist in
 * the environment, this answers 503 and the pricing UI says payments are
 * opening shortly. Setting the three variables turns it on — no deploy of
 * new code needed beyond this file.
 */

const PLANS = {
  // Amounts in paise, as Razorpay wants them.
  pro: { amount: 249_00, label: "pagehaul Pro, one month" },
  pack: { amount: 99_00, label: "pagehaul, 5 deep scans" },
} as const;

/** Pro runs a month plus grace; a pack has a year to be spent. */
const PRO_MS = 33 * 24 * 60 * 60_000;
const PACK_MS = 366 * 24 * 60 * 60_000;

export async function POST(req: NextRequest) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || !process.env.PH_LICENSE_SECRET) {
    return NextResponse.json(
      { error: "Payments are opening shortly.", code: "not_live" },
      { status: 503 },
    );
  }

  let body: {
    plan?: string;
    email?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const plan = body.plan === "pack" ? "pack" : body.plan === "pro" ? "pro" : null;
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  // The email is compulsory: it is where the receipt goes, and the one
  // handle support has when a browser loses the license it bought.
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Enter the email the receipt should go to." },
      { status: 400 },
    );
  }

  // Second half: the widget came back — check Razorpay's signature and mint.
  if (body.razorpay_payment_id) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: "Incomplete payment details." }, { status: 400 });
    }
    const expected = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
    }
    const token = mintLicense({
      plan,
      exp: Date.now() + (plan === "pro" ? PRO_MS : PACK_MS),
      ref: razorpay_payment_id,
      email,
    });
    if (!token) {
      return NextResponse.json({ error: "Licensing is not configured." }, { status: 500 });
    }
    return NextResponse.json({ token });
  }

  // First half: create the order the checkout widget will collect against.
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: PLANS[plan].amount,
      currency: "INR",
      // The email rides on the order itself, so every payment in the
      // Razorpay dashboard names its buyer even if our own token is lost.
      notes: { plan, email },
    }),
  });
  if (!res.ok) {
    console.error("razorpay order failed:", res.status, await res.text());
    return NextResponse.json(
      { error: "The payment service is not answering. Try again in a moment." },
      { status: 502 },
    );
  }
  const order = (await res.json()) as { id: string };
  return NextResponse.json({
    orderId: order.id,
    keyId,
    amount: PLANS[plan].amount,
    currency: "INR",
    label: PLANS[plan].label,
  });
}
