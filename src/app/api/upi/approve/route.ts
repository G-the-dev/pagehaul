import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { mintLicense } from "@/lib/license";
import { parkApproval } from "@/lib/upi-claims";

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
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;min-height:100svh;place-items:center;background:#0a0a0a;color:#fafafa;font-family:system-ui"><div style="text-align:center;padding:24px"><div style="font-size:40px">${ok ? "✓" : "✕"}</div><h1 style="font-size:19px;margin:12px 0 6px">${title}</h1><p style="color:#a1a1a1;font-size:14px;max-width:32ch">${body}</p></div>`,
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

  // The buyer's copy, so a missed poll still ends well.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM ?? "pagehaul <onboarding@resend.dev>",
        to: [email],
        subject: "Your pagehaul license",
        text: [
          "Payment received. Thank you.",
          "",
          "If the site did not unlock by itself, paste this license into",
          '"Already paid?" on the pricing dialog:',
          "",
          token,
          "",
          `Plan: ${plan === "pro" ? "Pro, one month" : "5 deep scans"}`,
        ].join("\n"),
      }),
    }).catch((e) => console.error("buyer license mail failed:", e));
  }

  return page(
    "Payment approved",
    `${plan === "pro" ? "Pro" : "Scan pack"} for ${email}. Their page unlocks by itself; the license was also emailed to them.`,
    true,
  );
}
