import { NextRequest, NextResponse } from "next/server";
import { PACK_PRICE_INR, PRO_PRICE_INR } from "@/lib/plan";
import { upiLive } from "@/lib/upi-config";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "I have paid": the buyer says a UPI payment with this reference is on its
 * way. UPI gives an individual no API to check that claim, so this route's
 * whole job is telling the owner, fast, with an approval link that carries
 * everything needed to mint the license. The owner glances at the payment
 * app, sees the reference in the note, and taps the link. Nothing here
 * trusts the buyer; money is confirmed by the person who received it.
 */

const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60_000;
const MAX_PER_WINDOW = 6;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) {
    for (const [k, v] of recent) {
      if (v.every((t) => now - t > WINDOW_MS)) recent.delete(k);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  if (!upiLive()) {
    return NextResponse.json(
      { error: "Payments are opening shortly.", code: "not_live" },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a while." },
      { status: 429 },
    );
  }

  let body: { plan?: string; email?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const plan = body.plan === "pack" ? "pack" : body.plan === "pro" ? "pro" : null;
  const email = (body.email ?? "").trim().toLowerCase();
  const ref = (body.ref ?? "").trim().toUpperCase();
  if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!/^PH-[A-Z2-9]{6}$/.test(ref)) {
    return NextResponse.json({ error: "Bad payment reference." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const adminKey = process.env.PH_ADMIN_KEY;
  const to = process.env.FEEDBACK_TO ?? SITE.contactEmail;
  if (!apiKey || !adminKey || !process.env.PH_LICENSE_SECRET) {
    return NextResponse.json(
      { error: "Payments are opening shortly.", code: "not_live" },
      { status: 503 },
    );
  }

  const amount = plan === "pro" ? PRO_PRICE_INR : PACK_PRICE_INR;
  const origin = req.nextUrl.origin;
  const approve = `${origin}/api/upi/approve?key=${encodeURIComponent(adminKey)}&ref=${encodeURIComponent(ref)}&plan=${plan}&email=${encodeURIComponent(email)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FEEDBACK_FROM ?? "pagehaul <onboarding@resend.dev>",
      to: [to],
      subject: `UPI payment claim: ₹${amount} ${plan} · ${ref}`,
      text: [
        `Plan: ${plan} (₹${amount})`,
        `Reference in the payment note: ${ref}`,
        `Buyer email: ${email}`,
        "",
        "This fires when the payment window opens; the buyer has four",
        "minutes to pay. When the amount shows up with this reference,",
        "approve:",
        approve,
        "",
        "No matching payment means they closed the window; ignore this mail.",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    console.error("upi claim mail failed:", res.status, await res.text().catch(() => ""));
    return NextResponse.json(
      { error: "Could not register the payment claim. Try again in a moment." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
