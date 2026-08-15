import type {
  Asset,
  AssetKind,
  ScanResult,
  Swatch,
  TypeSpec,
} from "./types";
import { displayNameFor } from "./naming";
import { assertPublicHttpUrl } from "./scan";

/**
 * Deep scan drives a real browser and records every response it receives, then
 * reads the rendered page for design data. The point is parity with what a
 * person sees in DevTools: not just imagery, but scripts, stylesheets, JSON
 * payloads and the API calls the page makes.
 *
 * It does not defeat authentication. A site that serves content only to a
 * signed-in session will return its shell here, and we say so rather than
 * reporting an empty result as success.
 */

const NAV_TIMEOUT_MS = 35_000;
const IDLE_TIMEOUT_MS = 12_000;
const SETTLE_MS = 2_500;
const MAX_ASSETS = 1_400;

/**
 * Scrolling exists to make lazy content load, so it has to move the way a
 * reader moves. Jumping straight to the bottom scrolls past every loader
 * without any of them ever being on screen, and grids that mount their tiles
 * on intersection stay empty.
 */
const SCROLL_STEPS = 45;
/** Long enough for a lazy tile to start fetching before we move again. */
const SCROLL_DWELL_MS = 600;
/** Ceiling on the whole scroll, well inside the route's 120s. */
const SCROLL_BUDGET_MS = 30_000;
/** Screens with no new height and no new media before we call it the end. */
const SCROLL_QUIET_STEPS = 3;

const EXT_KIND: Record<string, AssetKind> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", avif: "image",
  gif: "image", bmp: "image", ico: "image", apng: "image",
  svg: "svg",
  mp4: "video", webm: "video", ogv: "video", mov: "video", m4v: "video",
  m3u8: "video", mpd: "video",
  mp3: "audio", wav: "audio", ogg: "audio", aac: "audio", m4a: "audio", flac: "audio",
  woff: "font", woff2: "font", ttf: "font", otf: "font", eot: "font",
  pdf: "document", doc: "document", docx: "document", xls: "document",
  xlsx: "document", ppt: "document", pptx: "document", csv: "document",
  zip: "document", txt: "document",
  js: "code", mjs: "code", cjs: "code", jsx: "code", ts: "code", tsx: "code",
  css: "code", map: "code",
  json: "data", xml: "data", rss: "data", atom: "data", wasm: "data",
};

/** Content-type to kind, used when the URL carries no useful extension. */
const MIME_KIND: [RegExp, AssetKind][] = [
  [/^image\/svg/, "svg"],
  [/^image\//, "image"],
  [/^video\/|application\/(x-mpegurl|vnd\.apple\.mpegurl|dash\+xml)/, "video"],
  [/^audio\//, "audio"],
  [/^font\/|application\/(x-)?font|application\/vnd\.ms-fontobject/, "font"],
  [/^application\/pdf|officedocument|msword|ms-excel|ms-powerpoint|zip/, "document"],
  [/^(text|application)\/(javascript|ecmascript)|^text\/css/, "code"],
  [/^application\/(json|ld\+json)|^text\/xml|^application\/xml/, "data"],
];

const ALPHA = new Set(["png", "svg", "webp", "gif", "avif", "ico", "apng"]);

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
    const u = new URL(url);
    const seg = decodeURIComponent(u.pathname.split("/").pop() ?? "");
    const dot = seg.lastIndexOf(".");
    const base = dot > 0 ? seg.slice(0, dot) : seg;
    // API routes are usually path-shaped, so the last two segments read better.
    if (!base) {
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.slice(-2).join("/") || u.hostname;
    }
    return base;
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

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-blink-features=AutomationControlled"],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

interface MediaRec {
  url: string;
  alt?: string;
  w?: number;
  h?: number;
  section?: string;
}

/**
 * Everything mounted right now, with the section each thing sits in.
 *
 * Run repeatedly while scrolling, because a grid that recycles its tiles holds
 * maybe twenty nodes no matter how far you scroll. Reading once at the end sees
 * only the last screen; reading as we go sees all of it.
 *
 * Passed as a string on purpose. The build injects small helper functions into
 * compiled code, and those helpers do not exist inside the browser.
 */
const COLLECT_MEDIA = `(() => {
  const sectionOf = (el) => {
    let n = el, hops = 0;
    while (n && hops < 12) {
      const tag = n.tagName.toLowerCase();
      if (tag === 'header') return 'header';
      if (tag === 'footer') return 'footer';
      if (tag === 'nav') return 'nav';
      if (tag === 'main' || tag === 'article') return 'main';
      const hay = (n.className + ' ' + n.id).toLowerCase();
      if (/hero|banner|masthead/.test(hay)) return 'hero';
      if (/footer/.test(hay)) return 'footer';
      if (/header|topbar/.test(hay)) return 'header';
      n = n.parentElement; hops++;
    }
    return undefined;
  };
  const out = [];
  document.querySelectorAll('img').forEach((im) => {
    const src = im.currentSrc || im.src;
    if (!src || src.startsWith('data:')) return;
    out.push({
      url: src,
      alt: (im.alt || '').trim() || undefined,
      w: im.naturalWidth || undefined,
      h: im.naturalHeight || undefined,
      section: sectionOf(im),
    });
  });
  document.querySelectorAll('video').forEach((v) => {
    const src = v.currentSrc || v.src;
    if (src && !src.startsWith('data:')) out.push({ url: src, section: sectionOf(v) });
    if (v.poster) out.push({ url: v.poster, alt: 'poster frame', section: sectionOf(v) });
  });
  return out;
})()`;

/** One screen down, then report whether the page grew and where we are. */
const SCROLL_STEP = `(async () => {
  const measure = () => Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
  window.scrollBy(0, Math.round(window.innerHeight * 0.8));
  await new Promise((r) => setTimeout(r, ${SCROLL_DWELL_MS}));
  const height = measure();
  return { height, atBottom: window.scrollY + window.innerHeight >= height - 64 };
})()`;

interface Seen {
  url: string;
  kind: AssetKind;
  format: string;
  bytes?: number;
  method?: string;
  status?: number;
  contentType?: string;
  resourceType?: string;
  preview?: string;
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
    await page.setViewport({ width: 1512, height: 950, deviceScaleFactor: 2 });
    // Say who we actually are, minus the word "Headless".
    //
    // Chrome sends its own sec-ch-ua client hints on every request and we
    // cannot suppress them, so any user agent we invent is checked against a
    // version we did not choose. Claiming Chrome 126 from a Chrome 151 binary
    // is not a disguise, it is a contradiction, and it is precisely what bot
    // checks look for: Pinterest answers it with a stripped page holding three
    // images where the real one has dozens. Deriving both strings from the
    // browser in hand means there is nothing to disagree with.
    const product = (await browser.version()).replace(/^HeadlessChrome/, "Chrome");
    const uaPlatform =
      process.platform === "darwin"
        ? "Macintosh; Intel Mac OS X 10_15_7"
        : process.platform === "win32"
          ? "Windows NT 10.0; Win64; x64"
          : "X11; Linux x86_64";
    await page.setUserAgent(
      `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) ${product} Safari/537.36`,
    );
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    });

    // Record every response, classified. This is the network log.
    page.on("response", async (res) => {
      try {
        const url = res.url();
        if (!url.startsWith("http") || found.size > MAX_ASSETS) return;
        if (found.has(url)) return;

        const req = res.request();
        const rtype = req.resourceType();
        const ct = (res.headers()["content-type"] ?? "").toLowerCase();
        const ext = extOf(url);

        let kind: AssetKind | undefined;

        // XHR and fetch are the developer-facing surface, so they are their own
        // category regardless of what they return.
        if (rtype === "xhr" || rtype === "fetch") {
          kind = "api";
        } else {
          kind = EXT_KIND[ext];
          if (!kind) {
            for (const [re, k] of MIME_KIND) {
              if (re.test(ct)) {
                kind = k;
                break;
              }
            }
          }
          if (!kind && rtype === "document") kind = "document";
          if (!kind && rtype === "script") kind = "code";
          if (!kind && rtype === "stylesheet") kind = "code";
        }
        if (!kind) return;

        const len = Number(res.headers()["content-length"] ?? 0);

        // A short body preview makes an API row readable without opening it.
        let preview: string | undefined;
        if (kind === "api" && /json/.test(ct)) {
          try {
            const txt = await res.text();
            preview = txt.replace(/\s+/g, " ").slice(0, 180);
          } catch {
            /* body already consumed or streamed */
          }
        }

        found.set(url, {
          url,
          kind,
          format:
            kind === "api"
              ? (/json/.test(ct) ? "JSON" : (ct.split("/")[1] ?? "req").split(";")[0].toUpperCase())
              : (ext || ct.split("/")[1] || kind).split(";")[0].toUpperCase(),
          bytes: len > 0 ? len : undefined,
          method: req.method(),
          status: res.status(),
          contentType: ct.split(";")[0] || undefined,
          resourceType: rtype,
          preview,
        });
      } catch {
        /* a single bad response must never abort the scan */
      }
    });

    await page.goto(target.toString(), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // Let the app boot and issue its first data calls before scrolling.
    await page
      .waitForNetworkIdle({ idleTime: 900, timeout: IDLE_TIMEOUT_MS })
      .catch(() => {});

    // Walk the page down a screen at a time, reading what is mounted after each
    // step. Two things stop us: reaching the bottom of a page that has stopped
    // growing and stopped producing media, or running out of budget.
    const media = new Map<string, MediaRec>();
    const absorb = (list: MediaRec[]) => {
      for (const m of list) {
        const prev = media.get(m.url);
        if (!prev) {
          media.set(m.url, m);
          continue;
        }
        // A tile read before its image decoded reports no size. Keep whichever
        // pass actually learned something.
        prev.w ??= m.w;
        prev.h ??= m.h;
        prev.alt ??= m.alt;
        prev.section ??= m.section;
      }
    };

    absorb((await page.evaluate(COLLECT_MEDIA)) as MediaRec[]);

    const scrollDeadline = Date.now() + SCROLL_BUDGET_MS;
    let lastHeight = 0;
    let quiet = 0;
    for (let i = 0; i < SCROLL_STEPS && Date.now() < scrollDeadline; i++) {
      const step = (await page.evaluate(SCROLL_STEP)) as {
        height: number;
        atBottom: boolean;
      };
      const before = media.size;
      absorb((await page.evaluate(COLLECT_MEDIA)) as MediaRec[]);

      const grew = media.size > before || step.height !== lastHeight;
      lastHeight = step.height;
      if (step.atBottom && !grew) {
        if (++quiet >= SCROLL_QUIET_STEPS) break;
      } else {
        quiet = 0;
      }
    }

    await page
      .waitForNetworkIdle({ idleTime: 800, timeout: 6000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    absorb((await page.evaluate(COLLECT_MEDIA)) as MediaRec[]);
    await page.evaluate("window.scrollTo(0, 0)");

    // Read the rendered page: media detail, plus the design data the user asked
    // for. Computed styles are the only honest source for what a page paints.
    const pageData = await page.evaluate(() => {
      const media: {
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
        media.push({
          url: src,
          alt: im.alt?.trim() || undefined,
          w: im.naturalWidth || undefined,
          h: im.naturalHeight || undefined,
          section: sectionOf(im),
        });
      });

      document.querySelectorAll("video").forEach((v) => {
        const src = v.currentSrc || v.src;
        if (src && !src.startsWith("data:")) media.push({ url: src, section: sectionOf(v) });
        if (v.poster) media.push({ url: v.poster, alt: "poster frame", section: sectionOf(v) });
      });

      // ---- design data -------------------------------------------------
      const colorCount = new Map<string, { n: number; role: string }>();
      const fontMap = new Map<string, { weights: Set<string>; sizes: Set<string> }>();

      const toHex = (rgb: string): string | null => {
        const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(rgb);
        if (!m) return null;
        const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
        if (a < 0.12) return null; // effectively invisible
        const hex = [m[1], m[2], m[3]]
          .map((v) => Number(v).toString(16).padStart(2, "0"))
          .join("");
        return `#${hex}`;
      };

      const bump = (raw: string, role: string) => {
        const hex = toHex(raw);
        if (!hex) return;
        const prev = colorCount.get(hex);
        if (prev) prev.n += 1;
        else colorCount.set(hex, { n: 1, role });
      };

      const all = Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, 4000);
      for (const el of all) {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 1 && rect.height > 1;

        if (visible) {
          bump(cs.color, "text");
          if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
            bump(cs.backgroundColor, "background");
          }
          if (cs.borderTopWidth !== "0px") bump(cs.borderTopColor, "border");
        }

        // Fonts: only where there is actual text to render.
        if (el.textContent && el.textContent.trim().length > 1 && visible) {
          const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
          if (fam) {
            const rec = fontMap.get(fam) ?? { weights: new Set(), sizes: new Set() };
            rec.weights.add(cs.fontWeight);
            rec.sizes.add(cs.fontSize);
            fontMap.set(fam, rec);
          }
        }

        // Background images never appear in the source markup.
        const bg = cs.backgroundImage;
        if (bg && bg !== "none") {
          const m = /url\(["']?([^"')]+)["']?\)/.exec(bg);
          if (m && m[1] && !m[1].startsWith("data:")) {
            media.push({ url: m[1], section: sectionOf(el) });
          }
        }
      }

      // Declared design tokens, if the site publishes any.
      const tokens: { name: string; value: string }[] = [];
      try {
        const rootStyle = getComputedStyle(document.documentElement);
        for (let i = 0; i < rootStyle.length && tokens.length < 60; i++) {
          const prop = rootStyle[i];
          if (!prop.startsWith("--")) continue;
          const value = rootStyle.getPropertyValue(prop).trim();
          if (value && value.length < 60) tokens.push({ name: prop, value });
        }
      } catch {
        /* some pages lock this down */
      }

      const palette = Array.from(colorCount.entries())
        .map(([hex, v]) => ({ hex, count: v.n, role: v.role }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 18);

      const typography = Array.from(fontMap.entries())
        .map(([family, v]) => ({
          family,
          weights: Array.from(v.weights).sort(),
          sizes: Array.from(v.sizes)
            .sort((a, b) => parseFloat(b) - parseFloat(a))
            .slice(0, 6),
        }))
        .slice(0, 6);

      return { media, palette, typography, tokens, title: document.title };
    });

    // Merge rendered detail onto the network log. The final pass adds anything
    // reachable only through computed styles, chiefly CSS background images.
    absorb(pageData.media as MediaRec[]);
    const meta = media;
    for (const d of media.values()) {
      if (found.has(d.url)) continue;
      const ext = extOf(d.url);
      found.set(d.url, {
        url: d.url,
        kind: EXT_KIND[ext] ?? "image",
        format: (ext || "img").toUpperCase(),
      });
    }

    const assets: Asset[] = [];
    for (const s of found.values()) {
      const d = meta.get(s.url);
      const ext = extOf(s.url);
      const isPixel =
        (d?.w !== undefined && d.w <= 2) ||
        /\b(pixel|beacon|analytics|collect|track|spacer|1x1|blank)\b/i.test(s.url);

      assets.push({
        id: idOf(s.url),
        url: s.url,
        kind: s.kind,
        format: (s.format || "FILE").replace(/[^A-Z0-9]/gi, "").slice(0, 6) || "FILE",
        name: nameOf(s.url),
        displayName: "",
        bytes: s.bytes,
        width: d?.w,
        height: d?.h,
        alt: d?.alt,
        fromPage: target.toString(),
        section: d?.section,
        method: s.method,
        status: s.status,
        contentType: s.contentType,
        preview: s.preview,
        origin: (() => {
          try {
            return new URL(s.url).origin === target.origin ? "first-party" : "third-party";
          } catch {
            return "third-party";
          }
        })(),
        transparent: ALPHA.has(ext),
        noise: isPixel || undefined,
      });
    }

    const counters = new Map<string, number>();
    for (const a of assets) {
      const n = (counters.get(a.kind) ?? 0) + 1;
      counters.set(a.kind, n);
      a.displayName = displayNameFor(a, n);
    }

    const RANK: Record<string, number> = {
      image: 0, video: 1, svg: 2, font: 3, document: 4,
      audio: 5, api: 6, data: 7, code: 8,
    };
    assets.sort((x, y) => {
      if (!!x.noise !== !!y.noise) return x.noise ? 1 : -1;
      const k = (RANK[x.kind] ?? 9) - (RANK[y.kind] ?? 9);
      if (k !== 0) return k;
      return (y.bytes ?? 0) - (x.bytes ?? 0);
    });

    const LOGIN_WALLED =
      /(^|\.)(x\.com|twitter\.com|instagram\.com|facebook\.com|linkedin\.com|threads\.net)$/i;
    const realMedia = assets.filter(
      (a) => !a.noise && (a.kind === "image" || a.kind === "video"),
    ).length;

    if (LOGIN_WALLED.test(target.hostname) && realMedia < 5) {
      notes.push(
        `${target.hostname} serves its media only to signed-in sessions, so an automated browser receives the page shell and nothing more. That is access control rather than a technical limit, and it is what a browser extension carrying your own session would solve.`,
      );
    } else if (realMedia === 0 && assets.length < 5) {
      notes.push(
        "The page rendered but exposed almost nothing. It may require a login or actively block automated browsers.",
      );
    }

    return {
      target: target.toString(),
      pages: [{ url: target.toString(), title: pageData.title, ok: true }],
      assets,
      palette: pageData.palette as Swatch[],
      typography: pageData.typography as TypeSpec[],
      tokens: pageData.tokens,
      ms: Date.now() - started,
      notes,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
