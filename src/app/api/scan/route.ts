import { NextRequest, NextResponse } from "next/server";
import { scan } from "@/lib/scan";
import { deepScan, getScanTrace } from "@/lib/deepscan";
import { mergeScans } from "@/lib/merge";
import { acquireSlot, releaseSlot } from "@/lib/browser";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

/**
 * What this instance has ever found at an address, so a rescan can only
 * grow. A live page is a moving target — a carousel rotates, a lazy loader
 * wins one race and loses the next — and two honest scans of the same
 * address can disagree by a handful of files. People read that as the scan
 * being broken, and their rule is the right one: more is fine, less is
 * never. Each result is unioned with the last known set before it is
 * returned. Held per instance and slim — screenshots are per-scan captures
 * and stay out of it.
 */
const UNION_TTL_MS = 30 * 60_000;
const UNION_MAX = 24;
const lastKnown = new Map<string, { at: number; result: ScanResult }>();

function priorFor(key: string): ScanResult | null {
  const hit = lastKnown.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > UNION_TTL_MS) {
    lastKnown.delete(key);
    return null;
  }
  return hit.result;
}

function rememberUnion(key: string, result: ScanResult): void {
  const slim: ScanResult = {
    ...result,
    assets: result.assets.filter((a) => a.kind !== "screenshot"),
    notes: [],
  };
  lastKnown.set(key, { at: Date.now(), result: slim });
  while (lastKnown.size > UNION_MAX) {
    const oldest = lastKnown.keys().next().value;
    if (oldest === undefined) break;
    lastKnown.delete(oldest);
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

      // A hard wall on the whole deep scan, well inside the platform's own
      // kill. The wall is long enough to cover waiting for a browser slot
      // AND a full scan: several tabs scanning at once queue behind a
      // two-slot browser, and a queued scan that was judged by a clock that
      // started before its turn came back gutted every time. The clock now
      // starts when the slot is held; the wall covers the whole visit; and
      // if anything overruns it, the static read answers instead. The
      // outcome is always a result, never a timeout.
      const WALL_MS = 150_000;
      const wall = startedAt + WALL_MS;
      const remaining = () => wall - Date.now();
      // Each deep pass returns with headroom under the wall — enough for the
      // scan to hand back its own partial (browser-fetched files and the design
      // it read) rather than overrunning and leaving only the static read to
      // answer. Generous enough that a normal heavy page finishes in full, tight
      // enough that a pathological one still returns what it has well in time.
      const passDeadline = () => Math.min(wall - 10_000, Date.now() + 72_000);

      // The static read runs alongside and finishes in a second or two, so it is
      // always ready as the answer if the browser cannot make the wall.
      const quickPromise = scan(target, { depth: 1, skipSizes: true }).catch(
        () => null,
      );

      const deepFlow = (async (): Promise<typeof result | null> => {
        // One slot for the whole visit, retries included — held before any
        // pass clock starts, so queue time is never billed to the scan.
        await acquireSlot();
        try {
        // First pass, bounded so it returns well before the wall.
        let deep = await deepScan(target, { deadline: passDeadline() }).catch(
          (e) => {
            console.error("deep scan failed:", e instanceof Error ? e.message : e);
            return null;
          },
        );

        // Failed outright — try once more when a useful pass still fits. The
        // bar sits lower than a full pass on purpose: a heavy WebGL site can
        // kill the first attempt's browser outright, and forty seconds of
        // lean retry recovers the models and media that load early, which
        // beats handing the static read's shell back untried.
        if (!deep && remaining() > 40_000) {
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
        } finally {
          releaseSlot();
        }
      })();

      // The wall itself: if the deep work has not answered by now, hand back the
      // static read rather than let the request run to the platform's kill.
      const wallGuard = new Promise<"wall">((resolve) =>
        setTimeout(() => resolve("wall"), WALL_MS),
      );
      const raced = await Promise.race([deepFlow, wallGuard]);

      if (raced && raced !== "wall") {
        // The trace rides along on every deep result, not just walled ones —
        // the platform's logs are the one place it cannot be read from, and
        // "the scan finished but a phase quietly failed" is exactly the case
        // that needs diagnosing. The UI never shows it.
        result = { ...raced, debug: getScanTrace() } as typeof raced & {
          debug: string[];
        };
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
          // Where the deep pass actually got to before the wall — carried in
          // the payload because the platform's own logs are the one place
          // this cannot be read from. The UI never shows it.
          debug: getScanTrace(),
        } as typeof quick & { debug: string[] };
      }
    } else {
      result = await scan(normalise(body.url), {
        depth: body.depth === 2 ? 2 : 1,
        maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
      });
    }
    // A rescan may only grow: union with everything this instance has found
    // at the address before. The fresh scan wins every conflict; the prior
    // contributes only the files the fresh pass happened to miss.
    const prior = priorFor(cacheKey);
    if (prior) result = mergeScans(result, prior);
    rememberUnion(cacheKey, result);

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
