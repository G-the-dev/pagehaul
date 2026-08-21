import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { mintLicense } from "@/lib/license";
import { parkApproval } from "@/lib/upi-claims";
import { buyerUnlockEmail } from "@/lib/email";
import { sendMail } from "@/lib/mailer";
import { findOwnedPlans } from "@/lib/ledger";
import { PACK_PRICE_INR, PACK_SCANS, PRO_PRICE_INR } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The owner's approve link, opened from the claim email after the money is
 * seen in the payment app. Mints the license, parks it for the buyer's
 * polling dialog, and emails the buyer a copy so a missed poll costs one
 * paste rather than a support thread. GET on purpose: it has to work from
 * a phone's mail app with one tap.
 */

const PRO_MS = 33 * 24 * 60 * 60_000;
const PACK_MS = 366 * 24 * 60 * 60_000;

function keyOk(given: string | null): boolean {
  const expected = process.env.PH_ADMIN_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function page(
  title: string,
  body: string,
  ok: boolean,
  actionHtml = "",
): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;min-height:100svh;place-items:center;background:#0a0a0a;color:#fafafa;font-family:system-ui"><div style="text-align:center;padding:24px;max-width:340px"><div style="font-size:40px">${ok ? "✓" : "✕"}</div><h1 style="font-size:19px;margin:12px 0 6px">${title}</h1><p style="color:#a1a1a1;font-size:14px;line-height:1.6">${body}</p>${actionHtml}</div>`,
    { headers: { "content-type": "text/html" }, status: ok ? 200 : 403 },
  );
}

/** The payment window plus a little grace for slow banks. */
const STALE_AFTER_MS = 6 * 60_000;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (!keyOk(q.get("key"))) {
    return page("Not allowed", "This link is not valid.", false);
  }
  const plan = q.get("plan") === "pack" ? "pack" : q.get("plan") === "pro" ? "pro" : null;
  const email = (q.get("email") ?? "").trim().toLowerCase();
  const ref = (q.get("ref") ?? "").trim().toUpperCase();
  if (!plan || !/^PH-[A-Z2-9]{6}$/.test(ref) || !email) {
    return page("Missing details", "The link is incomplete.", false);
  }

  // A stale link does nothing by accident. The window closed minutes ago;
  // approving now takes a second, deliberate tap that says the money truly
  // arrived, late.
  const born = Number(q.get("t") ?? "0");
  const stale = born > 0 && Date.now() - born > STALE_AFTER_MS;
  if (stale && q.get("force") !== "1") {
    const mins = Math.round((Date.now() - born) / 60_000);
    const forceUrl = `${req.nextUrl.pathname}?${q.toString()}&force=1`;
    return page(
      "Window closed, not approved",
      `This payment window expired ${mins} minute${mins === 1 ? "" : "s"} ago. If ₹${plan === "pro" ? PRO_PRICE_INR : PACK_PRICE_INR} with reference ${ref} genuinely arrived, approve it deliberately:`,
      false,
      `<a href="${forceUrl}" style="display:inline-block;margin-top:18px;background:#fafafa;color:#111;text-decoration:none;font-size:14px;font-weight:600;padding:11px 26px;border-radius:999px">The money is in, approve</a>`,
    );
  }

  // Stacking: a renewal's month begins where the current one ends, and a
  // pack bought during Pro waits for Pro to finish. Nobody loses paid time
  // to paying early.
  const owned = await findOwnedPlans(email);
  const curPro =
    owned.current?.payload.plan === "pro" ? owned.current.payload : null;
  let exp: number;
  let nbf: number | undefined;
  if (plan === "pro") {
    exp = (curPro ? curPro.exp : Date.now()) + PRO_MS;
  } else if (curPro) {
    nbf = curPro.exp;
    exp = curPro.exp + PACK_MS;
  } else {
    exp = Date.now() + PACK_MS;
  }
  const token = mintLicense({ plan, exp, nbf, ref, email });
  if (!token) {
    return page("Licensing not configured", "PH_LICENSE_SECRET is not set.", false);
  }

  parkApproval(ref, token);

  // The buyer's copy: a link that unlocks any device it is opened on.
  // Nobody has to know what a license is; the link IS the purchase.
  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(token)}`;
  const startsOn = nbf
    ? new Date(nbf).toLocaleDateString("en-IN", { day: "numeric", month: "long" })
    : null;
  const mail = buyerUnlockEmail({
    plan,
    amount: plan === "pro" ? PRO_PRICE_INR : PACK_PRICE_INR,
    reference: ref,
    restoreUrl,
    packScans: PACK_SCANS,
    note: startsOn
      ? `Starts ${startsOn}, the moment Pro ends.`
      : curPro && plan === "pro"
        ? `Runs until ${new Date(exp).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`
        : undefined,
  });
  await sendMail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  // The Pro renewal reminder is no longer scheduled here: Gmail cannot
  // post-date a message. The buyer's own browser requests it when the
  // plan enters its final week; see /api/upi/renewal.

  return page(
    "Payment approved",
    `${plan === "pro" ? "Pro" : "Scan pack"} for ${email}. Their page unlocks by itself, and their unlock link is on its way to them.`,
    true,
  );
}
