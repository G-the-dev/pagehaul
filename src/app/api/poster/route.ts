import { NextRequest, NextResponse } from "next/server";
import { assertPublicHttpUrl } from "@/lib/scan";
import { getBrowser, acquireSlot, releaseSlot } from "@/lib/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A still frame from a video, captured server-side and cached.
 *
 * The grid cannot decode two hundred videos in the browser — it never keeps up,
 * which is the stutter of play buttons that never fill in. So the frame is
 * grabbed here instead: the shared headless browser loads the video, seeks a
 * little in, and screenshots it. A browser screenshot is not a canvas read, so
 * the cross-origin taint that blocks client-side capture does not apply — any
 * video from any origin yields a frame.
 *
 * Each frame is cached in the instance and returned with a long cache header,
 * so a video is captured once and then served instantly from the edge and the
 * browser. The tile is a plain <img> pointing here, which means it preloads and
 * caches exactly like every other thumbnail.
 */

const CACHE_MAX = 400;
const cache = new Map<string, Buffer>();
/** Videos that could not be captured, so a broken one is not retried forever. */
const failed = new Map<string, number>();
const FAIL_TTL = 5 * 60_000;

function cacheGet(key: string): Buffer | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // refresh recency
  }
  return hit;
}

function cacheSet(key: string, buf: Buffer): void {
  cache.set(key, buf);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Rendered in a page so a browser screenshot can grab the painted frame. */
function pageHtml(src: string, at: number): string {
  const safe = src.replace(/"/g, "&quot;");
  return `<!doctype html><html><head><style>
    html,body{margin:0;background:#000;overflow:hidden}
    video{display:block;width:640px;height:auto}
  </style></head><body>
    <video id="v" muted playsinline preload="auto" src="${safe}#t=${at}"></video>
    <script>
      const v = document.getElementById('v');
      window.__ready = false;
      window.__failed = false;
      v.addEventListener('error', () => { window.__failed = true; });
      v.addEventListener('seeked', () => { window.__ready = true; });
      v.addEventListener('loadeddata', () => {
        try { v.currentTime = ${at}; } catch (e) { window.__ready = true; }
      });
    </script>
  </body></html>`;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  let target: URL;
  try {
    target = assertPublicHttpUrl(raw);
  } catch {
    return NextResponse.json({ error: "That address cannot be captured." }, { status: 400 });
  }
  const key = target.toString();

  const cached = cacheGet(key);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
        "x-poster-cache": "hit",
      },
    });
  }

  const failedAt = failed.get(key);
  if (failedAt && Date.now() - failedAt < FAIL_TTL) {
    return NextResponse.json({ error: "No frame available." }, { status: 422 });
  }

  await acquireSlot();
  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });

    // A short seek: far enough to miss a black lead-in, cheap enough to reach.
    const at = 0.6;
    await page.setContent(pageHtml(key, at), {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });

    // Wait for a painted frame, with a hard ceiling so a stalled video cannot
    // hold the slot.
    const ok = await page
      .waitForFunction("window.__ready === true || window.__failed === true", {
        timeout: 12_000,
        polling: 120,
      })
      .then(() => page!.evaluate("window.__ready === true"))
      .catch(() => false);

    if (!ok) {
      failed.set(key, Date.now());
      return NextResponse.json({ error: "No frame available." }, { status: 422 });
    }

    const video = await page.$("#v");
    const shot = video
      ? await video.screenshot({ type: "jpeg", quality: 72 })
      : null;
    if (!shot) {
      failed.set(key, Date.now());
      return NextResponse.json({ error: "No frame available." }, { status: 422 });
    }

    const buf = Buffer.from(shot);
    cacheSet(key, buf);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
        "x-poster-cache": "miss",
      },
    });
  } catch (e) {
    console.error("poster capture failed:", e instanceof Error ? e.message : e);
    failed.set(key, Date.now());
    return NextResponse.json({ error: "Could not capture a frame." }, { status: 502 });
  } finally {
    await page?.close().catch(() => {});
    releaseSlot();
  }
}

type Browser = Awaited<ReturnType<typeof getBrowser>>;
