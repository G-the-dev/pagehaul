import type { Asset, AssetKind, ScanResult } from "./types";
import { displayNameFor } from "./naming";
import { assertPublicHttpUrl } from "./scan";

/**
 * Deep scan renders the page in a real browser and records every media file the
 * browser actually requests. That network log is exactly what a person sees in
 * DevTools, which is why this catches things a static parse cannot: lazy-loaded
 * images, anything a script injects, CSS-computed backgrounds, and media fetched
 * from an API after load.
 */

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_000;
const MAX_SCROLLS = 14;
const MAX_ASSETS = 900;

const EXT_KIND: Record<string, AssetKind> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", avif: "image",
  gif: "image", bmp: "image", ico: "image",
  svg: "svg",
  mp4: "video", webm: "video", ogv: "video", mov: "video", m3u8: "video", mpd: "video",
  mp3: "audio", wav: "audio", ogg: "audio", aac: "audio", m4a: "audio",
  woff: "font", woff2: "font", ttf: "font", otf: "font",
  pdf: "document",
};

const MIME_KIND: [RegExp, AssetKind][] = [
  [/^image\/svg/, "svg"],
  [/^image\//, "image"],
  [/^video\//, "video"],
  [/^audio\//, "audio"],
  [/^font\/|application\/font|application\/x-font/, "font"],
  [/^application\/pdf/, "document"],
];

const ALPHA = new Set(["png", "svg", "webp", "gif", "avif", "ico"]);

function extOf(url: string): string {
  try {
    const seg = new URL(url).pathname.split("/").pop() ?? "";
    const dot = seg.lastIndexOf(".");
    return dot > 0 ? seg.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

function nameOf(url: string): string {
  try {
    const seg = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
    const dot = seg.lastIndexOf(".");
    return (dot > 0 ? seg.slice(0, dot) : seg) || "untitled";
  } catch {
    return "untitled";
  }
}

function idOf(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return (h1 >>> 0).toString(36).padStart(7, "0") + (h2 >>> 0).toString(36).padStart(7, "0");
}

/** Resolves a browser binary: bundled chromium in the cloud, system Chrome locally. */
async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;
  const onVercel = !!process.env.VERCEL;

  if (onVercel) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const local =
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteer.launch({
    executablePath: local,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  });
}

interface Seen {
  url: string;
  kind: AssetKind;
  format: string;
  bytes?: number;
  fromNetwork: boolean;
}

export async function deepScan(rawUrl: string): Promise<ScanResult> {
  const started = Date.now();
  const target = assertPublicHttpUrl(rawUrl);
  const notes: string[] = [];
  const found = new Map<string, Seen>();

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    );

    // Every media file the browser fetches — the DevTools Network tab, captured.
    page.on("response", (res) => {
      try {
        const url = res.url();
        if (!url.startsWith("http") || found.size > MAX_ASSETS) return;
        const ct = (res.headers()["content-type"] ?? "").toLowerCase();
        const ext = extOf(url);

        let kind: AssetKind | undefined = EXT_KIND[ext];
        if (!kind) {
          for (const [re, k] of MIME_KIND) {
            if (re.test(ct)) {
              kind = k;
              break;
            }
          }
        }
        if (!kind) return;

        const len = Number(res.headers()["content-length"] ?? 0);
        const prev = found.get(url);
        if (prev && prev.bytes) return;
        found.set(url, {
          url,
          kind,
          format: (ext || ct.split("/")[1] || kind).split(";")[0].toUpperCase(),
          bytes: len > 0 ? len : undefined,
          fromNetwork: true,
        });
      } catch {
        /* one bad response must not abort the scan */
      }
    });

    await page.goto(target.toString(), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // Scroll the full page so lazy-loading and infinite-scroll content fires.
    await page.evaluate(async (maxScrolls: number) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let last = 0;
      for (let i = 0; i < maxScrolls; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(400);
        const h = document.body.scrollHeight;
        if (h === last) break;
        last = h;
      }
      window.scrollTo(0, 0);
      await sleep(250);
    }, MAX_SCROLLS);

    await new Promise((r) => setTimeout(r, SETTLE_MS));

    // The rendered DOM adds alt text and real dimensions, which the network log lacks.
    const domInfo = await page.evaluate(() => {
      const out: {
        url: string;
        alt?: string;
        w?: number;
        h?: number;
        section?: string;
      }[] = [];

      const sectionOf = (el: Element): string | undefined => {
        let n: Element | null = el;
        let hops = 0;
        while (n && hops < 12) {
          const tag = n.tagName.toLowerCase();
          if (tag === "header") return "header";
          if (tag === "footer") return "footer";
          if (tag === "nav") return "nav";
          if (tag === "main" || tag === "article") return "main";
          const hay = `${n.className} ${n.id}`.toLowerCase();
          if (/hero|banner|masthead/.test(hay)) return "hero";
          if (/footer/.test(hay)) return "footer";
          if (/header|topbar/.test(hay)) return "header";
          n = n.parentElement;
          hops++;
        }
        return undefined;
      };

      document.querySelectorAll("img").forEach((im) => {
        const src = im.currentSrc || im.src;
        if (!src || src.startsWith("data:")) return;
        out.push({
          url: src,
          alt: im.alt?.trim() || undefined,
          w: im.naturalWidth || undefined,
          h: im.naturalHeight || undefined,
          section: sectionOf(im),
        });
      });

      document.querySelectorAll("video").forEach((v) => {
        const src = v.currentSrc || v.src;
        if (src && !src.startsWith("data:")) {
          out.push({ url: src, section: sectionOf(v) });
        }
        if (v.poster) out.push({ url: v.poster, alt: "poster frame", section: sectionOf(v) });
      });

      // Computed backgrounds — these never appear in the source HTML.
      document.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === "none") return;
        const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
        if (m && m[1] && !m[1].startsWith("data:")) {
          out.push({ url: m[1], section: sectionOf(el) });
        }
      });

      return out;
    });

    const title = await page.title().catch(() => undefined);

    // Merge DOM detail onto the network log.
    const meta = new Map(domInfo.map((d) => [d.url, d]));
    for (const d of domInfo) {
      if (found.has(d.url)) continue;
      const ext = extOf(d.url);
      const kind = EXT_KIND[ext] ?? "image";
      found.set(d.url, {
        url: d.url,
        kind,
        format: (ext || "img").toUpperCase(),
        fromNetwork: false,
      });
    }

    const assets: Asset[] = [];
    for (const s of found.values()) {
      const d = meta.get(s.url);
      const ext = extOf(s.url);
      const isPixel =
        (d?.w !== undefined && d.w <= 2) ||
        /\b(pixel|beacon|analytics|track|spacer|1x1|blank)\b/i.test(s.url);
      assets.push({
        id: idOf(s.url),
        url: s.url,
        kind: s.kind,
        format: s.format.replace(/[^A-Z0-9]/gi, "").slice(0, 6) || "IMG",
        name: nameOf(s.url),
        displayName: "",
        bytes: s.bytes,
        width: d?.w,
        height: d?.h,
        alt: d?.alt,
        fromPage: target.toString(),
        section: d?.section,
        origin: (() => {
          try {
            return new URL(s.url).origin === target.origin ? "first-party" : "third-party";
          } catch {
            return "third-party";
          }
        })(),
        transparent: ALPHA.has(ext),
        noise: isPixel || s.kind === "code" || undefined,
      });
    }

    const counters = new Map<string, number>();
    for (const a of assets) {
      const n = (counters.get(a.kind) ?? 0) + 1;
      counters.set(a.kind, n);
      a.displayName = displayNameFor(a, n);
    }

    const RANK: Record<string, number> = {
      image: 0, video: 1, svg: 2, font: 3, document: 4, audio: 5, data: 6, code: 7,
    };
    assets.sort((x, y) => {
      if (!!x.noise !== !!y.noise) return x.noise ? 1 : -1;
      const k = (RANK[x.kind] ?? 9) - (RANK[y.kind] ?? 9);
      if (k !== 0) return k;
      return (y.bytes ?? 0) * (y.width ?? 1) - (x.bytes ?? 0) * (x.width ?? 1);
    });

    // Sites that gate content behind a session return their shell and nothing
    // else. Say so plainly rather than reporting an empty result as success.
    const LOGIN_WALLED = /(^|\.)(x\.com|twitter\.com|instagram\.com|facebook\.com|linkedin\.com|threads\.net)$/i;
    const realCount = assets.filter((a) => !a.noise && (a.kind === "image" || a.kind === "video")).length;

    if (LOGIN_WALLED.test(target.hostname) && realCount < 5) {
      notes.push(
        `${target.hostname} only serves its media to logged-in sessions, so an automated browser sees the page shell and nothing more. You can still see those images in your own browser because you are signed in — capturing them needs the browser extension, which is not built yet.`,
      );
    } else if (realCount === 0) {
      notes.push(
        "The page rendered but exposed no images or video. It may require a login, or block automated browsers.",
      );
    }

    return {
      target: target.toString(),
      pages: [{ url: target.toString(), title, ok: true }],
      assets,
      ms: Date.now() - started,
      notes,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
