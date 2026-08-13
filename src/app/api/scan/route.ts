import { NextRequest, NextResponse } from "next/server";
import { scan } from "@/lib/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalise(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("Enter a web address to scan.");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export async function POST(req: NextRequest) {
  let body: { url?: string; depth?: number; maxPages?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Enter a web address to scan." }, { status: 400 });
  }

  try {
    const result = await scan(normalise(body.url), {
      depth: body.depth === 2 ? 2 : 1,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong while scanning that page.";
    // 422 rather than 500 — these are almost always about the target, not us.
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
