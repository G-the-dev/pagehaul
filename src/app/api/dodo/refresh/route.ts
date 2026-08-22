import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { mintLicense, type LicensePayload } from "@/lib/license";
import { verifySubscription } from "@/lib/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A Pro token runs 33 days; a Dodo subscription renews monthly on its own.
 * When the token lapses, the browser brings it here: signature checked
 * with the expiry deliberately ignored, the subscription asked whether it
 * is still paying, and a fresh month minted if so. Renewal without anyone
 * doing anything, which is what a subscription promised.
 */

const PRO_MS = 33 * 24 * 60 * 60_000;

function readIgnoringExpiry(token: string | null): LicensePayload | null {
  const key = process.env.PH_LICENSE_SECRET;
  if (!key || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, mac] = parts;
  const expected = createHmac("sha256", key).update(body).digest("hex");
  if (mac.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LicensePayload;
    if (payload.plan !== "pro" && payload.plan !== "pack") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const payload = readIgnoringExpiry(body.token ?? null);
  if (!payload || payload.plan !== "pro" || !payload.sub) {
    return NextResponse.json({ error: "Nothing to refresh." }, { status: 400 });
  }

  const live = await verifySubscription(payload.sub);
  if (!live) {
    return NextResponse.json(
      { error: "The subscription is no longer active.", code: "lapsed" },
      { status: 402 },
    );
  }

  const token = mintLicense({
    plan: "pro",
    exp: Date.now() + PRO_MS,
    ref: live.ref,
    sub: live.sub,
    email: live.email,
  });
  if (!token) {
    return NextResponse.json({ error: "Licensing is not configured." }, { status: 500 });
  }
  return NextResponse.json({ token });
}
