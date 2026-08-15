import { NextRequest, NextResponse } from "next/server";
import { SITE } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receives a bug report or a piece of feedback and emails it on.
 *
 * Delivery goes through Resend's HTTP API directly rather than its SDK, since
 * the whole call is one fetch and a dependency buys nothing here.
 *
 * If the key is missing the route says so honestly and returns the address to
 * write to instead. A form that accepts a message and quietly drops it is worse
 * than no form, because the person believes they have been heard.
 */

const MAX_MESSAGE = 4000;
const MIN_MESSAGE = 10;

/** Crude per-IP throttle held in memory. Enough to stop a bored person. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);

  // Keep the map from growing without bound on a long lived process.
  if (recent.size > 5000) {
    for (const [k, v] of recent) {
      if (v.every((t) => now - t > WINDOW_MS)) recent.delete(k);
    }
  }
  return hits.length > MAX_PER_WINDOW;
}

const KINDS = new Set(["bug", "feedback", "other"]);

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (tooMany(ip)) {
    return NextResponse.json(
      { error: "That is a lot of messages. Try again later, or email us directly." },
      { status: 429 },
    );
  }

  let body: {
    kind?: string;
    message?: string;
    email?: string;
    url?: string;
    /** Hidden field. A real person never fills this in; a bot usually does. */
    website?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // Silently accept and discard anything that filled the honeypot, so a bot
  // gets no signal about why it failed.
  if (body.website) return NextResponse.json({ ok: true });

  const kind = KINDS.has(body.kind ?? "") ? body.kind! : "other";
  const message = (body.message ?? "").trim();
  const email = (body.email ?? "").trim();
  const pageUrl = (body.url ?? "").trim().slice(0, 300);

  if (message.length < MIN_MESSAGE) {
    return NextResponse.json(
      { error: "Please say a little more so we can act on it." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: "That message is too long. Email us instead." },
      { status: 400 },
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    return NextResponse.json(
      { error: "That email address does not look right." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FEEDBACK_FROM ?? "pagehaul <onboarding@resend.dev>";

  if (!apiKey) {
    return NextResponse.json(
      {
        error: `Messages are not set up yet. Please email ${SITE.contactEmail} instead.`,
        fallbackEmail: SITE.contactEmail,
      },
      { status: 503 },
    );
  }

  const label = kind === "bug" ? "Bug report" : kind === "feedback" ? "Feedback" : "Message";

  const lines = [
    `Type: ${label}`,
    email ? `Reply to: ${email}` : "Reply to: not given",
    pageUrl ? `Page they were scanning: ${pageUrl}` : null,
    `From IP: ${ip}`,
    "",
    message,
  ].filter(Boolean);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [SITE.contactEmail],
        // Replying goes straight back to the person, when they left an address.
        reply_to: email || undefined,
        subject: `${label} via ${SITE.name}`,
        text: lines.join("\n"),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Feedback send failed:", res.status, detail.slice(0, 300));
      return NextResponse.json(
        {
          error: `We could not send that. Please email ${SITE.contactEmail} instead.`,
          fallbackEmail: SITE.contactEmail,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Feedback send threw:", e);
    return NextResponse.json(
      {
        error: `We could not send that. Please email ${SITE.contactEmail} instead.`,
        fallbackEmail: SITE.contactEmail,
      },
      { status: 502 },
    );
  }
}
