import type {
  Asset,
  AssetKind,
  ScanResult,
  Swatch,
  TypeSpec,
} from "./types";
import { assignDisplayNames } from "./naming";
import { groupVariants } from "./variants";
import { assertPublicHttpUrl } from "./scan";
import { acquireSlot, releaseSlot, newScanPage } from "./browser";

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

const NAV_TIMEOUT_MS = 25_000;
const IDLE_TIMEOUT_MS = 8_000;
const SETTLE_MS = 2_500;
const MAX_ASSETS = 1_400;
/** Response bodies larger than this are previewed but never mined. */
const MAX_BODY_BYTES = 2_000_000;
const MAX_BODY_CHARS = 3_000_000;
/** How much of a serialised document we will hold in memory to mine. */
const MAX_DOCUMENT_CHARS = 8_000_000;

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
const SCROLL_BUDGET_MS = 20_000;

/**
 * When to stop gathering and start answering, whatever is left undone.
 *
 * The route may run for 120 seconds and a large site was reaching eighty, so a
 * slow run met the platform's limit instead of our own. That is the worst
 * possible failure: the function is killed mid-flight, the host returns its own
 * plain-text error page, and the caller receives something that is not even
 * JSON. Stopping early and returning a partial result is strictly better than
 * being stopped and returning nothing.
 */
const TOTAL_BUDGET_MS = 45_000;
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


/**
 * A format override written into the query, e.g. imgix's ?fm=mp4.
 *
 * The path may end .gif while the CDN has been asked to transcode to video —
 * pentagram does exactly this — and classifying by the path then points an
 * <img> at an mp4, which cannot decode. The last value wins, as it does at
 * the CDN.
 */
function formatOverride(u: URL): string | null {
  const fm = [...u.searchParams.getAll("fm"), ...u.searchParams.getAll("format")].pop();
  return fm && /^[a-z0-9]{2,5}$/i.test(fm) ? fm.toLowerCase() : null;
}

function extOf(url: string): string {
  try {
    const u = new URL(url);
    const fm = formatOverride(u);
    if (fm) return fm;
    const seg = u.pathname.split("/").pop() ?? "";
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


/**
 * True for the family of failures that all mean the same thing: the page moved
 * out from under a call we were part-way through.
 *
 * A client-side redirect, a router swapping the document, a frame being
 * replaced, or Chromium being killed for using too much memory all surface as
 * different messages — "Execution context was destroyed", "detached Frame",
 * "Target closed" — and every one of them used to end the scan and throw away
 * everything already collected.
 */
function isContextLost(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /execution context was destroyed|detached frame|target closed|session closed|protocol error|cannot find context|frame was detached|navigating and changing/i.test(
    m,
  );
}

/**
 * Runs something in the page, and survives the page going away mid-call.
 *
 * One retry, because the common case is a redirect landing: the first attempt
 * dies, the new document settles, the second succeeds. If it is still gone
 * after that, the caller gets the fallback and the scan carries on with
 * whatever the network log already holds.
 */
async function safeEval<T>(
  run: () => Promise<unknown>,
  fallback: T,
  retryDelayMs = 900,
  label?: string,
  attempts = 2,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return (await run()) as T;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (label) console.log(`[deepscan] ${label} attempt ${attempt} failed: ${msg.slice(0, 160)}`);
      if (!isContextLost(e)) return fallback;
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return fallback;
}

/**
 * Stops waiting on a page operation that outlives its budget.
 *
 * page.evaluate has no timeout of its own: a browser pegged by the page it is
 * running — a WebGL scene holding the main thread — can leave an evaluate
 * pending far longer than any deadline, and a loop that checks the clock
 * between calls never gets to check it. Racing each call against a timer caps
 * that. The stuck call keeps running until the page is closed; we simply move
 * on, and the deadline test upstream then does its job.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("page op timed out")), Math.max(500, ms)),
    ),
  ]);
}

interface PageData {
  media: MediaRec[];
  palette: unknown[];
  typography: unknown[];
  tokens: { name: string; value: string }[];
  fontFaces: { url: string; label: string }[];
  title: string;
}

/** What we report when the page never let us read it. */
const EMPTY_PAGE_DATA: PageData = {
  media: [],
  palette: [],
  typography: [],
  tokens: [],
  fontFaces: [],
  title: "",
};

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
  document.querySelectorAll('audio').forEach((a) => {
    const src = a.currentSrc || a.src;
    if (src && !src.startsWith('data:')) out.push({ url: src, section: sectionOf(a) });
    a.querySelectorAll('source[src]').forEach((s) => {
      const ss = s.getAttribute('src');
      if (ss && !ss.startsWith('data:')) out.push({ url: new URL(ss, location.href).href, section: sectionOf(a) });
    });
  });
  return out;
})()`;

/**
 * The design tokens a site declares on :root, read on their own.
 *
 * The full design read walks four thousand elements reading computed styles,
 * and on a stressed serverless browser that walk can fail outright, taking the
 * palette, the type and the declared tokens down with it — so a page with a
 * rich token set showed no Design tab at all. Reading the custom properties is
 * cheap and never touches that walk, so this runs separately and reliably:
 * even when the heavy read dies, the tokens survive and the tab stands.
 *
 * A string on purpose, for the same reason COLLECT_MEDIA is one.
 */
const READ_TOKENS = `(() => {
  const out = [];
  try {
    const rs = getComputedStyle(document.documentElement);
    for (let i = 0; i < rs.length && out.length < 60; i++) {
      const p = rs[i];
      if (p.indexOf('--') !== 0) continue;
      const v = rs.getPropertyValue(p).trim();
      if (v && v.length < 60) out.push({ name: p, value: v });
    }
  } catch (e) {}
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

/**
 * Media addresses written inside a payload rather than requested as one.
 *
 * JSON escapes its slashes, so the pattern tolerates the backslashes and they
 * are undone afterwards. Anchored on the extension because that is the one
 * part of a media URL that is reliably present.
 */
const MEDIA_URL_RE =
  /https?:(?:\\?\/){2}[^"'\s\\<>()]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|m4v|mov|mp3|wav|ogg|m4a|aac|flac|woff2?|pdf)(?:\?[^"'\s\\<>()]*)?/gi;

/** Capped per response: one feed payload can name thousands of thumbnails. */
const MINE_PER_RESPONSE = 300;
/** The document is mined once and holds the whole page, so it gets more room. */
const MINE_PER_DOCUMENT = 900;

function mineMediaUrls(text: string, limit = MINE_PER_RESPONSE): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  MEDIA_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MEDIA_URL_RE.exec(text)) && out.length < limit) {
    const raw = m[0].replace(/\\\//g, "/").replace(/&amp;/g, "&");
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

interface Seen {
  url: string;
  kind: AssetKind;
  format: string;
  /** Named in a network payload rather than fetched, so it has no status. */
  fromPayload?: boolean;
  bytes?: number;
  method?: string;
  status?: number;
  contentType?: string;
  resourceType?: string;
  preview?: string;
}

export async function deepScan(
  rawUrl: string,
  opts: { deadline?: number } = {},
): Promise<ScanResult> {
  const started = Date.now();
  // A wall the scan will not cross, whatever is left undone: at it, the scan
  // stops gathering and returns what it holds. The route sets it so a page too
  // heavy to finish yields its collected files as a partial result, rather than
  // running until the platform kills the function and yields nothing at all.
  const deadline = opts.deadline ?? started + TOTAL_BUDGET_MS + 20_000;
  const target = assertPublicHttpUrl(rawUrl);
  const notes: string[] = [];
  const found = new Map<string, Seen>();
  /** Set when the page interrupted us, so a thin result explains itself. */
  let renderNote = "";

  // A slot first, then the shared browser, then a private context inside it.
  // The context is what gets closed at the end; the browser stays warm for
  // whoever scans next.
  await acquireSlot();
  let scanPage: Awaited<ReturnType<typeof newScanPage>> | null = null;
  try {
    const page = await newScanPage();
    scanPage = page;
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
    const product = (await page.browser().version()).replace(/^HeadlessChrome/, "Chrome");
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

    // What the page itself answered, as opposed to any of its resources.
    let mainStatus = 0;

    // Record every response, classified. This is the network log.
    page.on("response", async (res) => {
      try {
        const url = res.url();
        if (!url.startsWith("http") || found.size > MAX_ASSETS) return;
        if (found.has(url)) return;

        const req = res.request();
        const rtype = req.resourceType();

        // Redirects carry their own status; the last document response in the
        // main frame is the one that decided what we actually got.
        if (rtype === "document" && res.frame() === page.mainFrame() && !res.status().toString().startsWith("3")) {
          mainStatus = res.status();
        }

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
        // The same body is also the best source of pictures on this page.
        //
        // An app fetches its content as JSON and then decides what to draw. If
        // it draws nothing — because it virtualises, because it waits for an
        // interaction, or because a bot check quietly withheld the feed — the
        // pictures still went past us, named in that payload. Reading it is the
        // difference between reporting what a page chose to render and
        // reporting what it actually holds.
        let preview: string | undefined;
        // Bodies are read to be mined, and a few large ones are enough to push
        // a memory-constrained browser over the edge — which arrives as
        // "Target closed" and looks like a crash rather than a diet problem.
        const tooBigToRead = len > MAX_BODY_BYTES;
        if (kind === "api" && !tooBigToRead && /json|text|javascript/.test(ct)) {
          try {
            const txt = await res.text();
            if (txt.length > MAX_BODY_CHARS) {
              preview = txt.slice(0, 180).replace(/\s+/g, " ");
              return;
            }
            preview = txt.replace(/\s+/g, " ").slice(0, 180);
            for (const u of mineMediaUrls(txt)) {
              if (found.size > MAX_ASSETS) break;
              if (found.has(u)) continue;
              const uext = extOf(u);
              const ukind = EXT_KIND[uext];
              if (!ukind) continue;
              found.set(u, {
                url: u,
                kind: ukind,
                format: (uext || "img").toUpperCase(),
                fromPayload: true,
              });
            }
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

    try {
      await page.goto(target.toString(), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (e) {
      // A page that redirects immediately can abort its own navigation. If any
      // response was recorded we know we reached the site, so carry on.
      if (!isContextLost(e) && found.size === 0) throw e;
      renderNote = "This page redirected while it was loading, so some of it may be missing. Scanning the address it landed on gets more.";
    }

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

    absorb(
      await safeEval<MediaRec[]>(
        () => withTimeout(page.evaluate(COLLECT_MEDIA), 7_000),
        [],
      ),
    );

    // Reads the design data — palette, type, tokens — off the rendered page.
    // Computed styles are the only honest source for what a page paints. Kept
    // as a helper so it can run before the scroll, when the browser context is
    // fresh, and again after; a heavy page can starve the late read.
    const readDesign = () =>
      safeEval<PageData>(() => withTimeout(page.evaluate(() => {
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

      // Every @font-face the page actually applied, mapped from the file it
      // loads to the family it declares. The browser has already parsed these,
      // so there is nothing to match with a regular expression — and unlike a
      // filename, the family name is what a person is looking for.
      const fontFaces: { url: string; label: string }[] = [];
      const seenFace = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList | undefined;
        try {
          rules = sheet.cssRules;
        } catch {
          // A cross-origin stylesheet will not open. The static read covers it.
          continue;
        }
        for (const rule of Array.from(rules ?? [])) {
          if (rule.constructor.name !== "CSSFontFaceRule") continue;
          const style = (rule as CSSFontFaceRule).style;
          const family = (style.getPropertyValue("font-family") || "")
            .replace(/['"]/g, "")
            .trim();
          if (!family) continue;
          const weight = (style.getPropertyValue("font-weight") || "").trim();
          const italic = /italic|oblique/i.test(
            style.getPropertyValue("font-style") || "",
          );
          // A variable font declares a range ("1 1000"), which is not a
          // weight anybody wants read out, and a family called "Input Mono
          // Bold" does not need 700 after it.
          const ranged = /\s/.test(weight);
          const spelled = /\b(thin|extralight|light|regular|book|medium|semibold|demibold|bold|extrabold|black|heavy)\b/i.test(family);
          const useWeight =
            weight && weight !== "normal" && weight !== "400" && !ranged && !spelled
              ? weight
              : "";
          const label = [family, useWeight, italic ? "Italic" : ""]
            .filter(Boolean)
            .join(" ");
          const src = style.getPropertyValue("src") || "";
          const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
          let m: RegExpExecArray | null;
          while ((m = re.exec(src))) {
            try {
              const abs = new URL(m[1].trim(), sheet.href || location.href).toString();
              if (seenFace.has(abs)) continue;
              seenFace.add(abs);
              fontFaces.push({ url: abs, label });
            } catch {
              /* a malformed src is not worth failing the scan over */
            }
          }
        }
      }

      return { media, palette, typography, tokens, fontFaces, title: document.title };
      // Four attempts, not one retry: a single-page app (resend.com) swaps its
      // main frame during load, and the read fails against the detached one
      // until the new frame settles. Retrying past that is what lets a design
      // read succeed on an app that navigates under it.
    }), 14_000), EMPTY_PAGE_DATA, 800, "readDesign", 4);

    // Capture design once up front, while the context is freshest. Tokens are
    // read separately too — a cheap, reliable read that stands even if the
    // heavy computed-style walk above fails on a stressed serverless browser.
    const earlyDesign = await readDesign();
    const earlyTokens = await safeEval<{ name: string; value: string }[]>(
      () => withTimeout(page.evaluate(READ_TOKENS), 5_000),
      [],
      400,
      "readTokens",
      4,
    );
    console.log(
      `[deepscan] early design: palette=${earlyDesign.palette.length} type=${earlyDesign.typography.length} tokens=${earlyDesign.tokens.length} liteTokens=${earlyTokens.length}`,
    );

    const scrollDeadline = Math.min(
      Date.now() + SCROLL_BUDGET_MS,
      started + TOTAL_BUDGET_MS,
      deadline,
    );
    let lastHeight = 0;
    let quiet = 0;
    for (let i = 0; i < SCROLL_STEPS && Date.now() < scrollDeadline; i++) {
      const step = await safeEval<{ height: number; atBottom: boolean }>(
        () => withTimeout(page.evaluate(SCROLL_STEP), 7_000),
        { height: lastHeight, atBottom: true },
      );
      const before = media.size;
      absorb(
        await safeEval<MediaRec[]>(
          () => withTimeout(page.evaluate(COLLECT_MEDIA), 7_000),
          [],
        ),
      );

      const grew = media.size > before || step.height !== lastHeight;
      lastHeight = step.height;
      if (step.atBottom && !grew) {
        if (++quiet >= SCROLL_QUIET_STEPS) break;
      } else {
        quiet = 0;
      }
    }

    // Everything past this point is optional polish, so it only happens if
    // there is time for it.
    const timeLeft = () =>
      Math.min(started + TOTAL_BUDGET_MS, deadline) - Date.now();

    if (timeLeft() > 10_000) {
      await page
        .waitForNetworkIdle({ idleTime: 800, timeout: 6000 })
        .catch(() => {});
      await new Promise((r) => setTimeout(r, SETTLE_MS));
    }
    absorb(
      await safeEval<MediaRec[]>(
        () => withTimeout(page.evaluate(COLLECT_MEDIA), 7_000),
        [],
      ),
    );
    await safeEval(() => withTimeout(page.evaluate("window.scrollTo(0, 0)"), 3_000), null);

    // Mine the rendered document as well as the network.
    //
    // A server-rendered app ships its data inside the page: __NEXT_DATA__, a
    // Nuxt state blob, an inline config object. Those addresses were never
    // requested, so the network log cannot know about them, and the app may
    // never draw them either. Reading the serialised DOM catches both the
    // markup and the script blocks in one pass.
    try {
      // Serialising a heavy page can itself take many seconds on a stressed
      // browser, so it is skipped when the wall is close — the network log and
      // the scroll passes already hold the media; this only adds payload URLs.
      if (timeLeft() < 8_000) throw new Error("no time to mine");
      // A heavy page serialises to many megabytes, and holding all of it while
      // a constrained browser is still working is part of what gets it killed.
      const html = (
        await safeEval<string>(() => withTimeout(page.content(), 8_000), "")
      ).slice(0, MAX_DOCUMENT_CHARS);
      for (const u of mineMediaUrls(html, MINE_PER_DOCUMENT)) {
        if (found.size > MAX_ASSETS) break;
        if (found.has(u)) continue;
        const uext = extOf(u);
        const ukind = EXT_KIND[uext];
        if (!ukind) continue;
        found.set(u, {
          url: u,
          kind: ukind,
          format: (uext || "img").toUpperCase(),
          fromPayload: true,
        });
      }
    } catch {
      /* a page that refuses to serialise is not a failed scan */
    }

    // Read design again now that everything has loaded. On a healthy page this
    // is the fuller answer; on a stressed one it comes back empty and the early
    // read carries it, per field, so the design tab is never lost to timing.
    //
    // But the read is a getComputedStyle walk over thousands of elements, and on
    // a pegged browser — a WebGL site holding the main thread — it can run for
    // tens of seconds and push the whole scan past its wall, at which point the
    // design already captured up front is thrown away with it. So it is skipped
    // when the early read already got a good answer, and when the wall is near:
    // a second, marginally fuller read is not worth losing the scan over.
    const haveEarly =
      earlyDesign.palette.length > 0 || earlyDesign.tokens.length > 0;
    const lateDesign =
      !haveEarly && Date.now() < deadline - 8_000
        ? await readDesign()
        : EMPTY_PAGE_DATA;
    const pageData: PageData = {
      media: lateDesign.media.length ? lateDesign.media : earlyDesign.media,
      palette: lateDesign.palette.length ? lateDesign.palette : earlyDesign.palette,
      typography: lateDesign.typography.length
        ? lateDesign.typography
        : earlyDesign.typography,
      // Tokens fall back one step further, to the standalone token read, so a
      // page whose whole computed-style walk failed still shows its tokens.
      tokens: lateDesign.tokens.length
        ? lateDesign.tokens
        : earlyDesign.tokens.length
          ? earlyDesign.tokens
          : earlyTokens,
      fontFaces: lateDesign.fontFaces.length
        ? lateDesign.fontFaces
        : earlyDesign.fontFaces,
      title: lateDesign.title || earlyDesign.title,
    };
    console.log(
      `[deepscan] final design: palette=${pageData.palette.length} type=${pageData.typography.length} tokens=${pageData.tokens.length}`,
    );

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
        section: d?.section ?? (s.fromPayload ? "payload" : undefined),
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

    // Name fonts by the family they declare rather than by their file.
    const faceByUrl = new Map<string, string>(
      (pageData.fontFaces as { url: string; label: string }[]).map((f) => [
        f.url,
        f.label,
      ]),
    );
    for (const a of assets) {
      if (a.kind !== "font") continue;
      const label = faceByUrl.get(a.url);
      if (label) a.fontFamily = label;
    }

    // One entry per picture rather than one per size. Payload mining in
    // particular yields whole families at once, since a feed names every
    // thumbnail it might need.
    groupVariants(assets);

    assignDisplayNames(assets);

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

    // A refusal is not an empty page, and saying so is the difference between
    // "this site has two files" and "this site turned us away". Sites rate
    // limit, and the same address that worked an hour ago can answer 403.
    let partial = false;
    if (renderNote) {
      notes.push(renderNote);
      partial = true;
    } else if (!pageData.title && media.size === 0 && found.size > 0) {
      notes.push(
        "This page stopped responding to us part way through, so this is what it had loaded by then.",
      );
      partial = true;
    }

    // The scan reached its time wall with more page left to read. Everything
    // here is real; it is just not everything. Say so, and mark it partial so
    // it is not cached and a rescan gets a fresh, fuller attempt.
    if (Date.now() >= deadline - 5_000 && !partial) {
      notes.push(
        "This page is heavy enough that the scan hit its time limit — these are the files gathered by then. Scanning again picks up from a fresh start.",
      );
      partial = true;
    }

    if (mainStatus >= 400) {
      const why =
        mainStatus === 429
          ? `${target.hostname} is rate limiting us. Waiting a few minutes usually clears it.`
          : mainStatus === 403
            ? `${target.hostname} refused the request (403). It blocks automated browsers, so what you see here is whatever loaded before the refusal.`
            : `${target.hostname} answered ${mainStatus}, so the page never loaded properly. Check the address is still live.`;
      notes.push(why);
    } else if (LOGIN_WALLED.test(target.hostname) && realMedia < 5) {
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
      partial: partial || undefined,
    };
  } finally {
    await scanPage?.close().catch(() => {});
    releaseSlot();
  }
}
