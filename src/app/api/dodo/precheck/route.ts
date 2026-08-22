import { NextRequest, NextResponse } from "next/server";
import { findOwnedPlans } from "@/lib/ledger";
import { resendUnlockEmail } from "@/lib/email";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Before the browser leaves for Dodo's checkout, the sent-mail ledger gets
 * a word: an email that already owns active Pro is not charged twice; it
 * gets its unlock link re-sent instead. Pack owners may always buy more.
 * A missing ledger fails open, never blocking a sale.
 */

export async function POST(req: NextRequest) {
  let body: { plan?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const plan = body.plan === "pack" ? "pack" : body.plan === "pro" ? "pro" : null;
  const email = (body.email ?? "").trim().toLowerCase();
  if (!plan || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const owned = await findOwnedPlans(email);
  if (owned.current?.payload.plan === "pro") {
    const mail = resendUnlockEmail({
      planLabel: "Pro",
      restoreUrl: `${req.nextUrl.origin}/#restore=${encodeURIComponent(owned.current.token)}`,
    });
    await sendMail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    return NextResponse.json(
      {
        error:
          plan === "pack"
            ? "Pro is on this email, and it includes everything. A sign-in link is in your inbox."
            : "Pro is on this email already. A sign-in link is in your inbox.",
        code: "has_plan",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
