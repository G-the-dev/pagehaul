import { NextRequest, NextResponse } from "next/server";
import { scan } from "@/lib/scan";
import { deepScan } from "@/lib/deepscan";
import { mergeScans } from "@/lib/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Recently finished scans, so asking for the same page twice is instant.
 *
 * Deep scans drive a real browser and take tens of seconds; a second look at
 * the same address should not pay that again. Held in the instance rather than
 * anywhere shared, which is enough — a warm function serves many requests, and
 * a cold one simply misses.
 *
 * Kept shorter than the seven minutes results live in the browser, so a repeat
 * scan can never hand back something older than the copy it replaces.
 */
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 24;
const cache = new Map<string, { at: number; body: string }>();

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh recency so a page being worked on stays warm.
  cache.delete(key);
  cache.set(key, hit);
  return hit.body;
}

function cacheSet(key: string, body: string): void {
  cache.set(key, { at: Date.now(), body });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function normalise(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("Enter a web address to scan.");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export async function POST(req: NextRequest) {
  let body: { url?: string; depth?: number; maxPages?: number; deep?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!body.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "Enter a web address to scan." }, { status: 400 });
  }

  try {
    const cacheKey = `${body.deep ? "deep" : "quick"}:${normalise(body.url)}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return new NextResponse(cached, {
        headers: { "content-type": "application/json", "cache-control": "no-store", "x-scan-cache": "hit" },
      });
    }

    let result: Awaited<ReturnType<typeof deepScan>>;

    if (body.deep) {
      // Run both and merge. A browser only knows what it fetched, so it never
      // sees the srcset candidates it passed over or any inline SVG; reading
      // the markup sees those but nothing drawn after load. Choosing deep
      // should never mean losing files that quick would have found.
      //
      // They run concurrently, so this costs the difference between them
      // rather than the sum, and a failure on the static side is not allowed
      // to take the whole scan down with it.
      const target = normalise(body.url);
      // Neither half is allowed to take the other down with it. A page that
      // navigates while the browser is reading it, or a Chromium that runs out
      // of memory, used to reject the pair and lose a static read that had
      // already succeeded — so the answer was an error page rather than the
      // files we were holding.
      // One retry, but only if the first attempt died quickly enough that
      // there is time for another. A browser killed for memory usually starts
      // cleanly the second time; a page that genuinely takes fifty seconds
      // should not be attempted twice.
      const startedAt = Date.now();
      const tryDeep = async () => {
        try {
          return await deepScan(target);
        } catch (e) {
          const why = e instanceof Error ? e.message : String(e);
          console.error("deep scan failed:", why);
          if (Date.now() - startedAt > 25_000) return null;
          try {
            return await deepScan(target);
          } catch (again) {
            console.error(
              "deep scan failed twice:",
              again instanceof Error ? again.message : again,
            );
            return null;
          }
        }
      };

      const [deepResult, quickResult] = await Promise.all([
        tryDeep(),
        scan(target, { depth: 1, skipSizes: true }).catch(() => null),
      ]);

      if (deepResult && quickResult) result = mergeScans(deepResult, quickResult);
      else if (deepResult) result = deepResult;
      else if (quickResult) {
        result = {
          ...quickResult,
          notes: [
            ...quickResult.notes,
            "The browser could not finish reading this page, so these are the files declared in its markup. Scanning again often works.",
          ],
        };
      } else {
        throw new Error("That page could not be read.");
      }
    } else {
      result = await scan(normalise(body.url), {
        depth: body.depth === 2 ? 2 : 1,
        maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
      });
    }
    const payload = JSON.stringify(result);
    cacheSet(cacheKey, payload);
    return new NextResponse(payload, {
      headers: { "content-type": "application/json", "cache-control": "no-store", "x-scan-cache": "miss" },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong while scanning that page.";
    // 422 rather than 500 — these are almost always about the target, not us.
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
