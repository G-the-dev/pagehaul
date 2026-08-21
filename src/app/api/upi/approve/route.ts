import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { mintLicense } from "@/lib/license";
import { parkApproval } from "@/lib/upi-claims";
import { buyerUnlockEmail, renewalReminderEmail } from "@/lib/email";
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

function page(title: string, body: string, ok: boolean): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;min-height:100svh;place-items:center;background:#0a0a0a;color:#fafafa;font-family:system-ui"><div style="text-align:center;padding:24px"><div style="font-size:40px">${ok ? "✓" : "✕"}</div><h1 style="font-size:19px;margin:12px 0 6px">${title}</h1><p style="color:#a1a1a1;font-size:14px;max-width:32ch">${body}</p></div>`,
    { headers: { "content-type": "text/html" }, status: ok ? 200 : 403 },
  );
}

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

  const token = mintLicense({
    plan,
    exp: Date.now() + (plan === "pro" ? PRO_MS : PACK_MS),
    ref,
    email,
  });
  if (!token) {
    return page("Licensing not configured", "PH_LICENSE_SECRET is not set.", false);
  }

  parkApproval(ref, token);

  // The buyer's copy: a link that unlocks any device it is opened on.
  // Nobody has to know what a license is; the link IS the purchase.
  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(token)}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM ?? "pagehaul <onboarding@resend.dev>";
  const send = (payload: Record<string, unknown>) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        reply_to: process.env.FEEDBACK_TO,
        ...payload,
      }),
    }).then(async (r) => {
      if (!r.ok) {
        console.error("mail send failed:", r.status, await r.text().catch(() => ""));
      }
    });

  if (apiKey) {
    const mail = buyerUnlockEmail({
      plan,
      amount: plan === "pro" ? PRO_PRICE_INR : PACK_PRICE_INR,
      reference: ref,
      restoreUrl,
      packScans: PACK_SCANS,
    });
    await send({
      to: [email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }).catch((e) => console.error("buyer unlock mail failed:", e));

    // Pro's renewal nudge, scheduled at purchase time for a week before
    // the end: no database, no cron, the mail is simply already in the
    // post. Resend delivers it on the date.
    if (plan === "pro") {
      const endsAt = Date.now() + PRO_MS;
      const endsOn = new Date(endsAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
      });
      const reminder = renewalReminderEmail({
        amount: PRO_PRICE_INR,
        restoreUrl,
        endsOn,
      });
      await send({
        to: [email],
        subject: reminder.subject,
        html: reminder.html,
        text: reminder.text,
        scheduled_at: new Date(endsAt - 7 * 24 * 60 * 60_000).toISOString(),
      }).catch((e) => console.error("renewal reminder schedule failed:", e));
    }
  }

  return page(
    "Payment approved",
    `${plan === "pro" ? "Pro" : "Scan pack"} for ${email}. Their page unlocks by itself, and their unlock link is on its way to them.`,
    true,
  );
}
