import { NextRequest, NextResponse } from "next/server";
import { mintLicense } from "@/lib/license";
import { verifyPayment, verifySubscription } from "@/lib/dodo";
import { buyerUnlockEmail } from "@/lib/email";
import { sendMail } from "@/lib/mailer";
import { PACK_PRICE_USD, PACK_SCANS, PRO_PRICE_USD } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The buyer lands back from Dodo's checkout with an id in the query; the
 * page hands it here. Dodo's API is the truth about whether money moved,
 * and a confirmed purchase mints the unlock token on the spot: the same
 * token, the same unlock email, the same sent-folder ledger as always,
 * just a different rail underneath.
 */

const PRO_MS = 33 * 24 * 60 * 60_000;
const PACK_MS = 366 * 24 * 60 * 60_000;

export async function POST(req: NextRequest) {
  let body: { payment_id?: string; subscription_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const purchase = body.subscription_id
    ? await verifySubscription(body.subscription_id)
    : body.payment_id
      ? await verifyPayment(body.payment_id)
      : null;

  if (!purchase) {
    return NextResponse.json(
      { error: "This payment could not be confirmed. If you were charged, reply to your receipt email." },
      { status: 402 },
    );
  }

  const token = mintLicense({
    plan: purchase.plan,
    exp: Date.now() + (purchase.plan === "pro" ? PRO_MS : PACK_MS),
    ref: purchase.ref,
    sub: purchase.sub,
    email: purchase.email,
  });
  if (!token) {
    return NextResponse.json({ error: "Licensing is not configured." }, { status: 500 });
  }

  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(token)}`;
  const mail = buyerUnlockEmail({
    plan: purchase.plan,
    amount: purchase.plan === "pro" ? PRO_PRICE_USD : PACK_PRICE_USD,
    reference: purchase.ref,
    restoreUrl,
    packScans: PACK_SCANS,
  });
  await sendMail({
    to: purchase.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return NextResponse.json({ token, plan: purchase.plan });
}
