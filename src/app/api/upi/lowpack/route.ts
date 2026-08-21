import { NextRequest, NextResponse } from "next/server";
import { verifyLicense } from "@/lib/license";
import { lowPackEmail } from "@/lib/email";
import { PACK_PRICE_INR, PACK_SCANS } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The pack's last-scan nudge. The browser notices its own pack running dry
 * and asks for the refill email; the token proves whose pack it is and
 * carries the address. Worst case someone triggers their own nudge twice,
 * which is why one per reference per instance is plenty of throttling.
 */

const sent = new Map<string, number>();

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const payload = verifyLicense(body.token ?? null);
  if (!payload || payload.plan !== "pack" || !payload.email) {
    return NextResponse.json({ error: "No pack found." }, { status: 400 });
  }

  const key = payload.ref ?? payload.email;
  if (sent.has(key)) return NextResponse.json({ ok: true });
  sent.set(key, Date.now());
  if (sent.size > 1000) {
    const oldest = sent.keys().next().value;
    if (oldest !== undefined) sent.delete(oldest);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: true });

  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(body.token!)}`;
  const mail = lowPackEmail({
    packScans: PACK_SCANS,
    amount: PACK_PRICE_INR,
    restoreUrl,
  });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM ?? "pagehaul <onboarding@resend.dev>",
      reply_to: process.env.FEEDBACK_TO,
      to: [payload.email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  }).catch((e) => console.error("low pack mail failed:", e));

  return NextResponse.json({ ok: true });
}
