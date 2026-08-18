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
 *
 * The screenshot pass keeps its own window against the route's deadline and
 * does not draw on this budget — a heavy page lawfully spends all of it on
 * the scroll and the mining, and a pass fed on leftovers never ran.
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
  // 3D models, in a kind of their own — a model is not a document.
  glb: "model", gltf: "model", usdz: "model",
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
  [/^model\//, "model"],
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
  /https?:(?:\\?\/){2}[^"'\s\\<>()]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|m4v|mov|mp3|wav|ogg|m4a|aac|flac|woff2?|pdf|glb|gltf|usdz)(?:\?[^"'\s\\<>()]*)?/gi;

/** Capped per response: one feed payload can name thousands of thumbnails. */
const MINE_PER_RESPONSE = 300;
/** The document is mined once and holds the whole page, so it gets more room. */
const MINE_PER_DOCUMENT = 900;

/**
 * Audio addresses written in code rather than markup.
 *
 * A hover sound leaves no other trace. It is fetched on mouseover — nobody
 * hovers during a scan, so it never crosses the network — and it plays through
 * the Web Audio API, so no <audio> element ever exists for the DOM walk to
 * find. The one place it does exist is as a string in a script:
 * "/sounds/tap.mp3" sitting in a bundle, waiting for an event handler.
 *
 * Quoted, so a bare extension in a MIME table never matches, and matched with
 * the quote pair intact so a string is read whole. Relative paths are the
 * common spelling in a bundle, so they are kept and resolved against the page.
 */
const AUDIO_IN_CODE_RE =
  /(["'`])([^"'`\s<>()\\]+\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)(?:\?[^"'`\s<>()\\]*)?)\1/gi;

/** Cheap pre-test, so most bundles are dismissed without running the miner. */
const AUDIO_EXT_HINT_RE = /\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)\b/i;

/** Capped across the whole scan: a page speaking of more audio than this in
 *  its code is a music library, and its API will name the files properly. */
const AUDIO_FROM_CODE_MAX = 60;
/** Candidates existence-checked before listing. */
const AUDIO_VERIFY_MAX = 24;

/**
 * Screenshots of the rendered page, taken at the end of the scan.
 *
 * By then the browser has already opened the page, scrolled it end to end and
 * let the lazy content land, so the capture is nearly free — and it is the one
 * thing a list of addresses cannot give a designer: what the page actually
 * looks like, section by section, ready to drop into a reference board.
 *
 * The shots travel inside the scan's own JSON as data URLs. Nothing changes
 * about the architecture: the server still stores nothing, the pixels move
 * once, live in the tab, and expire with the results. The budget below is what
 * keeps that JSON inside the platform's response cap (about 4.5MB) with room
 * for the asset list beside it.
 */
const SHOT_JPEG_QUALITY = 74;
const SHOT_MAX_SECTIONS = 10;
/** The full-page capture stops here; the section shots cover a longer page. */
const SHOT_MAX_FULL_HEIGHT = 12_000;
/**
 * The same cap where the browser is serverless. Rastering a very tall
 * beyond-viewport capture is what kills a constrained renderer: stripe.com at
 * 12,000px took the browser down and every capture after it, while 5,590px
 * sailed through. The full-page shot also runs last there for the same
 * reason — the small section shots are banked before the risky one is tried.
 */
const SHOT_MAX_FULL_HEIGHT_SERVERLESS = 8_000;
/**
 * Base64 characters across every shot together. The check runs before each
 * capture, so the last one can overshoot by its own size — the ceiling is set
 * low enough that even overshot, the shots plus a heavy page's asset list
 * still clear the platform's ~4.5MB response cap with room.
 */
const SHOT_BUDGET_CHARS = 2_200_000;
/** Kept back from the sections so the full-page shot always has room. */
const SHOT_FULL_PAGE_RESERVE = 1_000_000;

/**
 * Where the sections are. Landmarks first; a page built from bare divs
 * declares none, so the direct children of <main> — or of the tallest
 * wrapper — stand in. Each shot is named by the heading inside it, which is
 * the name a designer would reach for.
 *
 * A string on purpose, for the same reason COLLECT_MEDIA is one.
 */
const READ_SHOT_PLAN = `(() => {
  const vw = window.innerWidth;
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
  const sections = [];
  const taken = [];
  const labelOf = (el, fallback) => {
    const h = el.querySelector('h1, h2, h3');
    const t = h && h.textContent ? h.textContent.trim().replace(/\\s+/g, ' ') : '';
    if (t.length >= 3) return t.length > 42 ? t.slice(0, 39).trimEnd() + '…' : t;
    return fallback;
  };
  const push = (el, fallback) => {
    if (sections.length >= 14) return;
    // One shot per stretch of page: an element inside — or wrapped around —
    // one already taken is the same stretch again.
    if (taken.some((t) => t.contains(el) || el.contains(t))) return;
    const r = el.getBoundingClientRect();
    const y = r.top + window.scrollY;
    if (r.width < vw * 0.5 || r.height < 160 || r.height > 6000) return;
    if (y + r.height < 0 || y > docHeight) return;
    taken.push(el);
    sections.push({
      x: Math.max(0, Math.round(r.left + window.scrollX)),
      y: Math.max(0, Math.round(y)),
      w: Math.round(Math.min(r.width, vw)),
      h: Math.round(r.height),
      label: labelOf(el, fallback),
    });
  };
  document.querySelectorAll('header').forEach((el) => push(el, 'Header'));
  document.querySelectorAll('section, article').forEach((el) => push(el, ''));
  if (sections.length < 3) {
    let host = document.querySelector('main');
    if (!host) {
      let tallest = 0;
      const kids = document.body ? Array.from(document.body.children) : [];
      for (const el of kids) {
        const h = el.scrollHeight || 0;
        if (h > tallest) { tallest = h; host = el; }
      }
    }
    if (host) Array.from(host.children).forEach((el) => push(el, ''));
  }
  document.querySelectorAll('footer').forEach((el) => push(el, 'Footer'));
  sections.sort((a, b) => a.y - b.y);
  let n = 0;
  for (const s of sections) if (!s.label) s.label = 'Section ' + (++n);
  return { docHeight, viewportWidth: vw, sections };
})()`;

function mineAudioUrls(text: string, limit = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // JSON embedded in a script escapes its slashes; undo that first.
  const src = text.includes("\\/") ? text.replace(/\\\//g, "/") : text;
  AUDIO_IN_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AUDIO_IN_CODE_RE.exec(src)) && out.length < limit) {
    const raw = m[2].replace(/&amp;/g, "&");
    if (seen.has(raw)) continue;
    seen.add(raw);
    // An absolute URL, or a path with at least one segment. A bare
    // "notification.mp3" is usually a label in a settings object, not a file
    // at the site root, so it does not qualify.
    if (!/^https?:\/\//i.test(raw) && !raw.includes("/")) continue;
    out.push(raw);
  }
  return out;
}

/**
 * Which of the mined addresses are real, asked of the origin itself.
 *
 * A string in minified code is a claim, not a file — webpack writes paths that
 * only exist once a public prefix is glued on, and a library ships example
 * names its user never serves. One HEAD each settles it. Only a definite
 * "not here" (404/410) or an unreachable host removes a candidate; an origin
 * that answers HEAD rudely (403, 405) still holds the file, and stays listed.
 * The whole pass shares one budget so a slow origin cannot stall the scan.
 */
async function verifyAudioUrls(
  urls: string[],
  budgetMs: number,
): Promise<Map<string, number | undefined>> {
  const out = new Map<string, number | undefined>();
  await Promise.race([
    Promise.allSettled(
      urls.map(async (u) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), Math.min(3_500, budgetMs));
        try {
          const res = await fetch(u, {
            method: "HEAD",
            redirect: "follow",
            signal: ctrl.signal,
          });
          if (res.status === 404 || res.status === 410) return;
          const len = Number(res.headers.get("content-length") ?? 0);
          out.set(u, len > 0 ? len : undefined);
        } catch {
          /* unreachable — drop rather than list a dead address */
        } finally {
          clearTimeout(timer);
        }
      }),
    ),
    new Promise((r) => setTimeout(r, budgetMs)),
  ]);
  return out;
}

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
  /** Audio spoken of only in the site's code, held raw and resolved later. */
  const audioFromCode = new Set<string>();
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

        // Scripts get the same reading, for one kind only. Mining scripts for
        // images would drown the result in icon paths and route fragments;
        // audio is rare enough in code to take whole, and code is the only
        // place a hover sound exists at all — see AUDIO_IN_CODE_RE.
        if (
          rtype === "script" &&
          !tooBigToRead &&
          audioFromCode.size < AUDIO_FROM_CODE_MAX
        ) {
          try {
            const txt = await res.text();
            if (txt.length <= MAX_BODY_CHARS && AUDIO_EXT_HINT_RE.test(txt)) {
              for (const u of mineAudioUrls(txt)) {
                if (audioFromCode.size >= AUDIO_FROM_CODE_MAX) break;
                audioFromCode.add(u);
              }
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

    let navHiccup = false;
    try {
      await page.goto(target.toString(), {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
    } catch (e) {
      // A modern app frequently interrupts its own first navigation — a client
      // redirect, a router taking over, a hydration reload — and Puppeteer
      // reports that as a lost context here. On its own it means nothing: what
      // matters is whether a real page settles afterwards. So note it and decide
      // later, once the page has had a chance to come back, rather than blaming
      // a redirect that a perfectly good load will trip too.
      if (!isContextLost(e) && found.size === 0) throw e;
      navHiccup = true;
    }

    // Let the app boot and issue its first data calls before scrolling. After an
    // interrupted navigation, give the real document an extra moment to land.
    await page
      .waitForNetworkIdle({ idleTime: 900, timeout: IDLE_TIMEOUT_MS })
      .catch(() => {});
    if (navHiccup) await new Promise((r) => setTimeout(r, 1_200));

    // Only now, having looked, decide whether the interruption actually cost
    // anything. A page that came back with a rendered body is an ordinary load —
    // warning about it and hiding its files behind a "partial" flag is a false
    // alarm. Only a page that never recovered is genuinely incomplete.
    if (navHiccup) {
      const recovered = await safeEval<boolean>(
        () =>
          withTimeout(
            page.evaluate(
              () => !!(document.body && document.body.childElementCount > 3),
            ),
            5_000,
          ),
        false,
      );
      if (!recovered) {
        renderNote =
          "This page redirected while it was loading, so some of it may be missing. Scanning the address it landed on gets more.";
      }
    }

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
      // A generous cap: the computed-style walk over thousands of elements is
      // genuinely slow on a stressed serverless browser, and cutting it short
      // loses the palette a slightly-slower read would have returned. Long
      // enough to let that read finish, short enough that a browser pegged flat
      // by the page still gives up rather than running to the wall.
    }), 24_000), EMPTY_PAGE_DATA, 800, "readDesign", 4);

    // Capture design once up front, while the context is freshest. Tokens are
    // read separately too — a cheap, reliable read that stands even if the
    // heavy computed-style walk above fails on a stressed serverless browser.
    const readTokensNow = () =>
      safeEval<{ name: string; value: string }[]>(
        () => withTimeout(page.evaluate(READ_TOKENS), 5_000),
        [],
        400,
        "readTokens",
        4,
      );

    let earlyDesign = await readDesign();
    let earlyTokens = await readTokensNow();
    console.log(
      `[deepscan] early design: palette=${earlyDesign.palette.length} type=${earlyDesign.typography.length} tokens=${earlyDesign.tokens.length} liteTokens=${earlyTokens.length}`,
    );

    // Every read empty and no title means the page swapped its main frame out
    // from under us — a client redirect or a hydration reload — and left the old
    // one detached, so every evaluate fails though the page itself loaded fine.
    // This is what strands the design AND stops the scroll from triggering lazy
    // images, since the scroll runs the same way. A fresh navigation re-attaches
    // a live frame; do it once, early, so the reads and the scroll that follow
    // land on a page that answers. (gowthamoleti.com does exactly this.)
    const readsDead =
      !earlyDesign.title &&
      !earlyDesign.palette.length &&
      !earlyDesign.tokens.length &&
      !earlyTokens.length;
    if (readsDead && Date.now() < deadline - 25_000) {
      const landed = page.url();
      const renavOk = await safeEval<boolean>(
        () =>
          page
            .goto(landed && landed !== "about:blank" ? landed : target.toString(), {
              waitUntil: "domcontentloaded",
              timeout: 15_000,
            })
            .then(() => true),
        false,
      );
      if (renavOk) {
        await page
          .waitForNetworkIdle({ idleTime: 700, timeout: 5_000 })
          .catch(() => {});
        await new Promise((r) => setTimeout(r, 900));
        earlyDesign = await readDesign();
        earlyTokens = await readTokensNow();
        console.log(
          `[deepscan] after re-nav: palette=${earlyDesign.palette.length} tokens=${earlyTokens.length} title=${!!earlyDesign.title}`,
        );
      }
    }

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

    // ---- screenshots -----------------------------------------------------
    // Taken as soon as the page has been walked, ahead of the payload mining
    // and the late design read, and answering to the route's wall rather
    // than the gathering budget. Everything before this point may lawfully
    // spend that whole internal budget — on slow serverless hardware
    // stripe.com did exactly that, every time — and a pass that runs on the
    // leftovers never runs there at all. So the captures get a window of
    // their own: bounded by its own slice so a response cannot balloon, and
    // by the wall with margin left to build and return the result. The
    // captures are wrapped in safeEval like every other page operation, so a
    // shot that dies costs the shots alone. See the SHOT_* constants for
    // what this is and why it is budgeted.
    const screenshots: Asset[] = [];
    // A serverless CPU rasters slowly — the same section that captures in two
    // seconds on a laptop can need ten there — so the window and the patience
    // per shot both grow where the browser is serverless. The route's wall
    // still holds either way.
    const SHOT_SLICE_MS = process.env.VERCEL ? 28_000 : 15_000;
    const SHOT_EACH_MS = process.env.VERCEL ? 12_000 : 9_000;
    const shotWindow = Math.min(deadline - 8_000, Date.now() + SHOT_SLICE_MS);
    const shotTime = () => shotWindow - Date.now();
    if (shotTime() > 6_000) {
      // Drop to 1x for the captures. Layout is CSS-px identical, so nothing
      // moves; the raster Chromium has to hold for a beyond-viewport shot
      // halves, which is what keeps a long page from pushing a serverless
      // browser over its memory edge. Media reads are all done by now, so the
      // retina srcset picks the 2x viewport existed for are already recorded.
      const viewOk = await safeEval<boolean>(
        () =>
          page
            .setViewport({ width: 1512, height: 950, deviceScaleFactor: 1 })
            .then(() => true),
        false,
      );
      if (viewOk) {
        await new Promise((r) => setTimeout(r, 400));

        const plan = await safeEval<{
          docHeight: number;
          viewportWidth: number;
          sections: { x: number; y: number; w: number; h: number; label: string }[];
        }>(
          () => withTimeout(page.evaluate(READ_SHOT_PLAN), 8_000),
          { docHeight: 0, viewportWidth: 0, sections: [] },
          700,
          "shotPlan",
        );

        let shotChars = 0;
        const capture = async (
          clip: { x: number; y: number; width: number; height: number },
          label: string,
          ceiling = SHOT_BUDGET_CHARS,
        ): Promise<boolean> => {
          if (shotChars > ceiling || shotTime() < 1_500) return false;
          const b64 = await safeEval<string>(
            () =>
              withTimeout(
                page.screenshot({
                  type: "jpeg",
                  quality: SHOT_JPEG_QUALITY,
                  encoding: "base64",
                  captureBeyondViewport: true,
                  clip,
                }) as Promise<string>,
                // Never longer than the window itself has left.
                Math.max(2_000, Math.min(SHOT_EACH_MS, shotTime())),
              ),
            "",
            700,
            "screenshot",
          );
          if (!b64) return false;
          shotChars += b64.length;
          screenshots.push({
            id: idOf(`shot:${screenshots.length}:${label}`),
            url: `data:image/jpeg;base64,${b64}`,
            kind: "screenshot",
            format: "JPG",
            name: label,
            displayName: "",
            alt: label,
            width: Math.round(clip.width),
            height: Math.round(clip.height),
            bytes: Math.round(b64.length * 0.75),
            fromPage: target.toString(),
            origin: "first-party",
            inline: true,
          });
          return true;
        };

        if (plan.docHeight > 0) {
          // Sections first, full page last. The tall capture is the one that
          // can take a constrained renderer down with it, so the small shots
          // are banked before it is tried, and a slice of the byte budget is
          // held back so a section-rich page cannot spend the full shot's room.
          let missed = Math.max(0, plan.sections.length - SHOT_MAX_SECTIONS);
          for (const s of plan.sections.slice(0, SHOT_MAX_SECTIONS)) {
            const ok = await capture(
              { x: s.x, y: s.y, width: s.w, height: s.h },
              s.label,
              SHOT_BUDGET_CHARS - SHOT_FULL_PAGE_RESERVE,
            );
            if (!ok) missed++;
          }
          const fullHeight = Math.min(
            plan.docHeight,
            process.env.VERCEL ? SHOT_MAX_FULL_HEIGHT_SERVERLESS : SHOT_MAX_FULL_HEIGHT,
          );
          await capture(
            { x: 0, y: 0, width: plan.viewportWidth || 1512, height: fullHeight },
            // A capped capture is the top of the page, and saying "full"
            // about it would be a small lie told on every long page.
            fullHeight < plan.docHeight ? "Top of the page" : "Full page",
          );
          if (screenshots.length > 0 && missed > 0) {
            notes.push(
              `${missed} section${missed === 1 ? "" : "s"} went unscreenshotted — the page ran past the scan's screenshot budget.`,
            );
          }
        }
      }
    }
    console.log(
      `[deepscan] shots: taken=${screenshots.length} chars=${screenshots.reduce(
        (n, a) => n + a.url.length,
        0,
      )} windowLeft=${shotTime()}`,
    );
    // Silence would read as "this page has no sections". Say what happened.
    if (screenshots.length === 0) {
      notes.push(
        "No screenshot could be taken — the page either used up the scan's time or would not hold still for a capture.",
      );
    }


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
      // Inline scripts never arrive as network responses, so the audio they
      // speak of is only reachable here, in the serialised page.
      if (AUDIO_EXT_HINT_RE.test(html)) {
        for (const u of mineAudioUrls(html)) {
          if (audioFromCode.size >= AUDIO_FROM_CODE_MAX) break;
          audioFromCode.add(u);
        }
      }
    } catch {
      /* a page that refuses to serialise is not a failed scan */
    }

    // Turn the audio mined out of code into listed files: resolve each string
    // against the page it belongs to, and ask the origin whether it is real.
    // Verification is skipped when the wall is close — a candidate listed
    // unchecked beats a scan that overran and returned nothing.
    if (audioFromCode.size) {
      let baseHref = target.toString();
      try {
        const landed = page.url();
        if (landed && landed.startsWith("http")) baseHref = landed;
      } catch {
        /* the target is base enough */
      }
      const candidates: string[] = [];
      const resolved = new Set<string>();
      for (const raw of audioFromCode) {
        try {
          // The same guard every server-side fetch gets. A page could write
          // an internal address into its code precisely so the verification
          // pass would probe it on the server's behalf.
          const u = assertPublicHttpUrl(new URL(raw, baseHref).toString());
          const s = u.toString();
          if (found.has(s) || resolved.has(s)) continue;
          resolved.add(s);
          candidates.push(s);
        } catch {
          /* not an address after all, or not one we may fetch */
        }
      }
      const shortlist = candidates.slice(0, AUDIO_VERIFY_MAX);
      const verified =
        timeLeft() > 6_000
          ? await verifyAudioUrls(
              shortlist,
              Math.min(4_500, timeLeft() - 2_000),
            )
          : new Map<string, number | undefined>(
              shortlist.map((u) => [u, undefined]),
            );
      for (const [u, bytes] of verified) {
        if (found.size > MAX_ASSETS) break;
        const uext = extOf(u);
        found.set(u, {
          url: u,
          kind: "audio",
          format: (uext || "audio").toUpperCase(),
          fromPayload: true,
          bytes,
        });
      }
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
        // A 43-byte GIF is a tracking pixel whatever it is called — appnexus
        // and adsct carry none of the words the pattern below knows. No
        // picture worth taking fits in a hundred bytes.
        (s.kind === "image" && s.bytes !== undefined && s.bytes <= 100) ||
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

    // The captures join the list here, past the noise checks built for
    // network files — a data URL holds no pixel-tracker names to misread.
    assets.push(...screenshots);

    // One entry per picture rather than one per size. Payload mining in
    // particular yields whole families at once, since a feed names every
    // thumbnail it might need.
    groupVariants(assets);

    assignDisplayNames(assets);

    const RANK: Record<string, number> = {
      image: 0, screenshot: 1, video: 2, svg: 3, model: 4, font: 5, document: 6,
      audio: 7, api: 8, data: 9, code: 10,
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
    } else if (!pageData.title && media.size === 0 && found.size > 0 && found.size < 12) {
      // The browser read nothing off the page, yet the network log did catch
      // something — so the page half-loaded. Only call that "stopped responding"
      // when the haul is genuinely thin. A page that still yielded dozens of
      // files through the network log is a successful scan whose on-page read
      // happened to fail; flagging it partial (and paying for a second pass)
      // over a missing palette is worse than just handing over the files.
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
    } else if (
      realMedia === 0 &&
      // Screenshots are ours, not the page's — two captures of an empty shell
      // must not make it count as a page that exposed something.
      assets.filter((a) => a.kind !== "screenshot").length < 5
    ) {
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
