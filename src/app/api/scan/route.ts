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
      const startedAt = Date.now();

      // A hard wall on the whole deep scan. The platform kills a function at
      // 120 seconds, and the caller then receives nothing — not even the files
      // already found. A page heavy enough to run that long is exactly where
      // someone still wants what was collected, so the work is bounded well
      // inside that limit: one deep pass runs to a deadline, a further pass runs
      // only when it clearly fits, and if anything overruns the wall the static
      // read answers instead. The outcome is always a result, never a timeout.
      const WALL_MS = 88_000;
      const wall = startedAt + WALL_MS;
      const remaining = () => wall - Date.now();
      // Each deep pass returns with real headroom under the wall — enough for
      // the scan to hand back its own partial (browser-fetched files and the
      // design it read) rather than overrunning and leaving only the static
      // read to answer. No single pass is given more than a minute.
      const passDeadline = () => Math.min(wall - 14_000, Date.now() + 58_000);

      // The static read runs alongside and finishes in a second or two, so it is
      // always ready as the answer if the browser cannot make the wall.
      const quickPromise = scan(target, { depth: 1, skipSizes: true }).catch(
        () => null,
      );

      const deepFlow = (async (): Promise<typeof result | null> => {
        // First pass, bounded so it returns well before the wall.
        let deep = await deepScan(target, { deadline: passDeadline() }).catch(
          (e) => {
            console.error("deep scan failed:", e instanceof Error ? e.message : e);
            return null;
          },
        );

        // Failed outright — try once more, but only if a whole pass still fits.
        if (!deep && remaining() > 50_000) {
          deep = await deepScan(target, { deadline: passDeadline() }).catch(
            () => null,
          );
        }

        // A partial result means the page interrupted the browser. A second
        // pass can complete it, and each may hold files the other missed — but
        // only when there is clearly time, so a heavy page that spent its budget
        // on the first pass returns what it has rather than reaching for the wall.
        if (deep?.partial && remaining() > 50_000) {
          const second = await deepScan(target, {
            deadline: passDeadline(),
          }).catch(() => null);
          if (second) {
            const better = second.partial
              ? second.assets.length >= deep.assets.length
                ? second
                : deep
              : second;
            const other = better === second ? deep : second;
            const combined = mergeScans(better, other);
            if (!second.partial) {
              combined.notes = second.notes;
              combined.partial = undefined;
            }
            deep = combined;
          }
        }

        const quick = await quickPromise;
        if (deep && quick) return mergeScans(deep, quick);
        if (deep) return deep;
        if (quick) {
          return {
            ...quick,
            notes: [
              ...quick.notes,
              "The browser could not finish reading this page, so these are the files declared in its markup. Scanning again often works.",
            ],
            partial: true,
          };
        }
        return null;
      })();

      // The wall itself: if the deep work has not answered by now, hand back the
      // static read rather than let the request run to the platform's kill.
      const wallGuard = new Promise<"wall">((resolve) =>
        setTimeout(() => resolve("wall"), WALL_MS),
      );
      const raced = await Promise.race([deepFlow, wallGuard]);

      if (raced && raced !== "wall") {
        result = raced;
      } else {
        const quick = await quickPromise;
        if (!quick) throw new Error("That page could not be read in time.");
        result = {
          ...quick,
          notes: [
            ...quick.notes,
            "This page was too heavy to finish a deep scan within the time limit, so these are the files declared in its markup. A quick scan is instant, and a deep scan may finish on a second try.",
          ],
          partial: true,
        };
      }
    } else {
      result = await scan(normalise(body.url), {
        depth: body.depth === 2 ? 2 : 1,
        maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
      });
    }
    const payload = JSON.stringify(result);
    if (!result.partial) cacheSet(cacheKey, payload);
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
