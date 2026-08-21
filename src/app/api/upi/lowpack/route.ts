import { NextRequest, NextResponse } from "next/server";
import { verifyLicense } from "@/lib/license";
import { lowPackEmail } from "@/lib/email";
import { PACK_PRICE_INR, PACK_SCANS } from "@/lib/plan";
import { sendMail } from "@/lib/mailer";

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

  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(body.token!)}`;
  const mail = lowPackEmail({
    packScans: PACK_SCANS,
    amount: PACK_PRICE_INR,
    restoreUrl,
  });
  await sendMail({
    to: payload.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return NextResponse.json({ ok: true });
}
