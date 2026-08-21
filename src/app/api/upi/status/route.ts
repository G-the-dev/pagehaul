import { NextRequest, NextResponse } from "next/server";
import { collectApproval } from "@/lib/upi-claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The buyer's dialog asks every few seconds whether its reference was approved. */
export async function GET(req: NextRequest) {
  const ref = (req.nextUrl.searchParams.get("ref") ?? "").trim().toUpperCase();
  if (!/^PH-[A-Z2-9]{6}$/.test(ref)) {
    return NextResponse.json({ error: "Bad reference." }, { status: 400 });
  }
  const token = collectApproval(ref);
  return NextResponse.json(token ? { token } : { pending: true });
}
