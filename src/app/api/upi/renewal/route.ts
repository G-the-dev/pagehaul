import { NextRequest, NextResponse } from "next/server";
import { verifyLicense } from "@/lib/license";
import { renewalReminderEmail } from "@/lib/email";
import { PRO_PRICE_INR } from "@/lib/plan";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Pro renewal nudge, requested by the browser that noticed its own
 * plan entering the last week. Gmail cannot schedule mail the way an email
 * API can, so the visit is the scheduler: a Pro user who shows up inside
 * the final seven days triggers exactly one reminder. One who never shows
 * up was not going to renew off an email either.
 */

const SEVEN_DAYS = 7 * 24 * 60 * 60_000;
const sent = new Map<string, number>();

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const payload = verifyLicense(body.token ?? null);
  if (!payload || payload.plan !== "pro" || !payload.email) {
    return NextResponse.json({ error: "No plan found." }, { status: 400 });
  }
  if (payload.exp - Date.now() > SEVEN_DAYS) {
    return NextResponse.json({ ok: true });
  }

  const key = payload.ref ?? payload.email;
  if (sent.has(key)) return NextResponse.json({ ok: true });
  sent.set(key, Date.now());
  if (sent.size > 1000) {
    const oldest = sent.keys().next().value;
    if (oldest !== undefined) sent.delete(oldest);
  }

  const restoreUrl = `${req.nextUrl.origin}/#restore=${encodeURIComponent(body.token!)}`;
  const endsOn = new Date(payload.exp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
  });
  const mail = renewalReminderEmail({
    amount: PRO_PRICE_INR,
    restoreUrl,
    endsOn,
  });
  await sendMail({
    to: payload.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  return NextResponse.json({ ok: true });
}
