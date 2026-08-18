import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Asset, AssetKind, Origin, ScanPage, ScanResult } from "./types";
import { assignDisplayNames } from "./naming";
import { groupVariants } from "./variants";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const HTML_TIMEOUT_MS = 12_000;
const CSS_TIMEOUT_MS = 8_000;
const HEAD_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 6_000_000;
const MAX_CSS_BYTES = 3_000_000;
const MAX_STYLESHEETS = 12;
const HEAD_CONCURRENCY = 16;

const EXT_KIND: Record<string, AssetKind> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", avif: "image",
  gif: "image", bmp: "image", ico: "image", apng: "image", jfif: "image",
  svg: "svg",
  mp4: "video", webm: "video", ogv: "video", mov: "video", m4v: "video",
  m3u8: "video", mpd: "video",
  // No audio, deliberately: sound is a deep-scan feature. The audio a page
  // actually plays almost never sits in its markup — it is fetched by a hover
  // handler or a player script — so the odd <audio> tag a static read can see
  // promised a coverage it could not deliver. One scan owns the kind.
  woff: "font", woff2: "font", ttf: "font", otf: "font", eot: "font",
  pdf: "document", doc: "document", docx: "document", xls: "document",
  xlsx: "document", ppt: "document", pptx: "document", txt: "document",
  rtf: "document", zip: "document", rar: "document",
  // 3D models, in a kind of their own — a model is not a document. The
  // web serves many spellings of one idea: glTF and its binary twin, the
  // print formats, the scan formats, gaussian splats, and the sidecars
  // (obj's mtl, draco's drc) that a model is incomplete without.
  glb: "model", gltf: "model", usdz: "model", usd: "model",
  obj: "model", mtl: "model", fbx: "model", stl: "model",
  ply: "model", dae: "model", "3mf": "model", drc: "model",
  wrl: "model", x3d: "model", splat: "model", spz: "model",
  css: "code", js: "code", mjs: "code", map: "code",
  json: "data", xml: "data", csv: "data", rss: "data", atom: "data",
};

/** Formats that can carry an alpha channel — these get the checkerboard preview. */
const ALPHA = new Set(["png", "svg", "webp", "gif", "avif", "apng", "ico"]);

/** Documents we follow from plain <a href> links. */
const LINKED_DOC_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "csv", "json", "xml", "zip", "rtf", "txt",
  "glb", "gltf", "usdz", "obj", "fbx", "stl", "ply", "dae", "3mf",
]);


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
    if (dot < 0 || dot === seg.length - 1) return "";
    return seg.slice(dot + 1).toLowerCase();
  } catch {
    return "";
  }
}

function nameOf(url: string): string {
  try {
    const p = new URL(url).pathname;
    const seg = decodeURIComponent(p.split("/").pop() ?? "");
    const dot = seg.lastIndexOf(".");
    const base = dot > 0 ? seg.slice(0, dot) : seg;
    return base || "untitled";
  } catch {
    return "untitled";
  }
}

/** Short, stable id. Not cryptographic — only needs to be collision-free per scan. */
function idOf(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(36).padStart(7, "0") +
    (h2 >>> 0).toString(36).padStart(7, "0")
  );
}

/**
 * Blocks non-http(s) schemes and obvious internal targets so a submitted URL
 * cannot be used to probe private network space from the server.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That does not look like a valid web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https addresses can be scanned.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error("Local addresses cannot be scanned.");
  }
  // Literal private / link-local / loopback IPv4 and IPv6 ranges.
  if (
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80")
  ) {
    throw new Error("Private network addresses cannot be scanned.");
  }
  return u;
}

async function fetchText(
  url: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ text: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,text/css,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`The site returned ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len && len > maxBytes) throw new Error("That page is too large to scan.");
    const text = await res.text();
    return { text: text.slice(0, maxBytes), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function abs(base: string, ref: string): string | null {
  if (!ref) return null;
  const t = ref.trim();
  if (!t || t.startsWith("#") || t.startsWith("javascript:") || t.startsWith("mailto:")) {
    return null;
  }
  if (t.startsWith("data:")) return t;
  try {
    return new URL(t, base).toString();
  } catch {
    return null;
  }
}

/** Nearest meaningful ancestor, used to label roughly where an asset sits. */
function sectionOf($: cheerio.CheerioAPI, el: Element): string | undefined {
  let node: Element | null = el;
  let hops = 0;
  while (node && hops < 14) {
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "header") return "header";
    if (tag === "footer") return "footer";
    if (tag === "nav") return "nav";
    if (tag === "aside") return "aside";
    if (tag === "main" || tag === "article") return "main";
    const cls = String($(node).attr("class") ?? "").toLowerCase();
    const id = String($(node).attr("id") ?? "").toLowerCase();
    const hay = `${cls} ${id}`;
    if (/\bhero\b|\bbanner\b|\bmasthead\b|\bjumbotron\b/.test(hay)) return "hero";
    if (/\bheader\b|\btopbar\b/.test(hay)) return "header";
    if (/\bfooter\b/.test(hay)) return "footer";
    if (/\bnav\b|\bmenu\b/.test(hay)) return "nav";
    node = node.parent && node.parent.type === "tag" ? (node.parent as Element) : null;
    hops++;
  }
  return undefined;
}

/** Parses a srcset into entries sorted smallest-first by declared width. */
function parseSrcset(base: string, value: string): { url: string; w: number }[] {
  const out: { url: string; w: number }[] = [];
  for (const part of value.split(",")) {
    const bits = part.trim().split(/\s+/);
    if (!bits[0]) continue;
    const u = abs(base, bits[0]);
    if (!u) continue;
    let w = 0;
    for (const b of bits.slice(1)) {
      if (b.endsWith("w")) w = parseInt(b, 10) || 0;
      else if (b.endsWith("x")) w = Math.round((parseFloat(b) || 1) * 1000);
    }
    out.push({ url: u, w });
  }
  return out.sort((a, b) => a.w - b.w);
}

type Draft = Omit<Asset, "id" | "kind" | "format" | "name" | "origin">;

class Collector {
  private map = new Map<string, Asset>();
  constructor(private pageOrigin: string) {}

  add(url: string | null, draft: Partial<Draft> & { fromPage: string }) {
    if (!url) return;
    const isData = url.startsWith("data:");
    if (this.map.has(url)) {
      // Keep the richest record when the same URL turns up twice.
      const prev = this.map.get(url)!;
      if (!prev.alt && draft.alt) prev.alt = draft.alt;
      if (!prev.section && draft.section) prev.section = draft.section;
      if (!prev.width && draft.width) prev.width = draft.width;
      if (!prev.height && draft.height) prev.height = draft.height;
      if (!prev.poster && draft.poster) prev.poster = draft.poster;
      if (!prev.thumbUrl && draft.thumbUrl) prev.thumbUrl = draft.thumbUrl;
      return;
    }

    let ext = isData ? "" : extOf(url);
    let kind: AssetKind | undefined;

    if (isData) {
      const m = /^data:([^;,]+)/.exec(url);
      const mime = m?.[1] ?? "";
      if (mime.startsWith("image/svg")) { kind = "svg"; ext = "svg"; }
      else if (mime.startsWith("image/")) { kind = "image"; ext = mime.split("/")[1] ?? "png"; }
      else if (mime.startsWith("font/")) { kind = "font"; ext = "woff2"; }
      else return; // ignore inline scripts/styles as data URLs
    } else {
      kind = EXT_KIND[ext];
    }

    if (!kind) return;

    let origin: Origin = "third-party";
    try {
      origin = isData || new URL(url).origin === this.pageOrigin ? "first-party" : "third-party";
    } catch {
      /* keep third-party */
    }

    this.map.set(url, {
      id: idOf(url),
      url,
      kind,
      format: (ext || kind).toUpperCase(),
      name: isData ? `inline-${kind}` : nameOf(url),
      displayName: "",
      origin,
      transparent: ALPHA.has(ext),
      inline: isData || undefined,
      ...draft,
    });
  }

  setFontFamily(url: string, family: string) {
    const a = this.map.get(url);
    if (a && a.kind === "font") a.fontFamily = family;
  }

  all(): Asset[] {
    return [...this.map.values()];
  }
}

const MEDIA_URL_RE =
  /https?:(?:\\?\/){2}[^"'\s\\<>()]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|m4v|mov|woff2?|pdf|glb|gltf|usdz|obj|fbx|stl|ply|dae|drc|splat|spz)(?:\?[^"'\s\\<>()]*)?/gi;

/**
 * Pulls media URLs straight out of the raw HTML, including ones embedded in JSON
 * blobs. Framework payloads (__NEXT_DATA__, Nuxt state, inline config) hold image
 * URLs that never appear as markup attributes, so a pure DOM walk misses them.
 */
function mineRawUrls(html: string, page: string, c: Collector) {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  MEDIA_URL_RE.lastIndex = 0;
  while ((m = MEDIA_URL_RE.exec(html))) {
    // JSON escapes slashes; undo that before treating it as a URL.
    const raw = m[0].replace(/\\\//g, "/").replace(/&amp;/g, "&");
    if (seen.has(raw) || seen.size > 1200) continue;
    seen.add(raw);
    c.add(raw, { fromPage: page, section: "embedded" });
  }
}

/** Reads real family names out of @font-face so fonts are not labelled by hash. */
function extractFontFamilies(css: string, cssUrl: string): Map<string, string> {
  const out = new Map<string, string>();
  const blocks = css.match(/@font-face\s*\{[^}]*\}/gi) ?? [];
  for (const b of blocks) {
    const fam = /font-family\s*:\s*(['"]?)([^;'"]+)\1/i.exec(b)?.[2]?.trim();
    if (!fam) continue;
    const weight = /font-weight\s*:\s*([^;]+)/i.exec(b)?.[1]?.trim();
    const style = /font-style\s*:\s*(italic|oblique)/i.exec(b)?.[1];
    // Matches the deep scan: no variable-font ranges, and no weight number
    // after a family that already spells the weight out.
    const ranged = weight ? /\s/.test(weight) : false;
    const spelled =
      /\b(thin|extralight|light|regular|book|medium|semibold|demibold|bold|extrabold|black|heavy)\b/i.test(fam);
    const useWeight =
      weight && weight !== "normal" && weight !== "400" && !ranged && !spelled ? weight : "";
    const label = [fam, useWeight, style ? "Italic" : ""].filter(Boolean).join(" ");
    const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    let u: RegExpExecArray | null;
    while ((u = urlRe.exec(b))) {
      const abs2 = abs(cssUrl, u[2].trim());
      if (abs2) out.set(abs2, label);
    }
  }
  return out;
}

function extractFromCss(css: string, cssUrl: string, page: string, c: Collector) {
  // url(...) references — images, fonts, and anything else the stylesheet pulls in.
  const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(css))) {
    const raw = m[2].trim();
    if (!raw || raw.startsWith("#")) continue;
    c.add(abs(cssUrl, raw), { fromPage: page, section: "stylesheet" });
  }
}

async function scanOnePage(
  pageUrl: string,
  c: Collector,
  notes: string[],
): Promise<{ page: ScanPage; links: string[] }> {
  let html: string;
  let finalUrl = pageUrl;
  try {
    const r = await fetchText(pageUrl, HTML_TIMEOUT_MS, MAX_HTML_BYTES);
    html = r.text;
    finalUrl = r.finalUrl;
  } catch (e) {
    return {
      page: { url: pageUrl, ok: false, error: (e as Error).message },
      links: [],
    };
  }

  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || undefined;
  const base = $("base[href]").attr("href")
    ? abs(finalUrl, $("base[href]").attr("href")!) ?? finalUrl
    : finalUrl;

  // --- images -------------------------------------------------------------
  $("img").each((_, el) => {
    const $el = $(el);
    const section = sectionOf($, el);
    const alt = $el.attr("alt")?.trim() || undefined;
    const w = parseInt($el.attr("width") ?? "", 10) || undefined;
    const h = parseInt($el.attr("height") ?? "", 10) || undefined;

    const srcsetRaw = $el.attr("srcset") || $el.attr("data-srcset");
    let thumbUrl: string | undefined;
    let variantKey: string | undefined;
    if (srcsetRaw) {
      const variants = parseSrcset(base, srcsetRaw);
      if (variants.length) {
        // Smallest that is still tile-sized. srcset often opens with a tiny
        // placeholder entry, and previewing that paints a blur.
        thumbUrl = (
          variants.find((v) => v.w === 0 || v.w >= 180) ??
          variants[variants.length - 1]
        ).url;
        variantKey = idOf(variants.map((v) => v.url).join("|"));
        variants.forEach((v, i) => {
          c.add(v.url, {
            fromPage: finalUrl,
            section,
            alt,
            // The vetted thumb from above — variants[0] here is exactly the
            // 20-32px placeholder the vetting exists to reject.
            thumbUrl,
            variantKey,
            isLargest: i === variants.length - 1,
            // The srcset's own width descriptor: a 420w entry is 420px wide.
            // Kept for every plausible pixel width, not just large ones, so a
            // build-hashed variant the browser never rendered still labels as
            // a size rather than "other size".
            width: v.w >= 100 && v.w < 10000 ? v.w : undefined,
          });
        });
      }
    }

    for (const attr of ["src", "data-src", "data-original", "data-lazy-src"]) {
      const v = $el.attr(attr);
      if (!v) continue;
      c.add(abs(base, v), {
        fromPage: finalUrl,
        section,
        alt,
        width: w,
        height: h,
        thumbUrl,
        variantKey,
        isLargest: variantKey ? true : undefined,
      });
    }
  });

  // <picture><source srcset> — art-directed and format variants.
  //
  // A <picture> is one image expressed as several files: a WebP source, a PNG
  // source, an <img> fallback, each with its own srcset ladder. They share
  // nothing in the URL — a build tool content-hashes every size of every
  // format to its own opaque name — so the only thing tying them together is
  // that they live in one <picture> describing one thing. Carry the <img>'s
  // alt onto every source, and grouping folds the whole picture into one card.
  $("picture").each((_, pic) => {
    const $pic = $(pic);
    const section = sectionOf($, pic);
    const alt = $pic.find("img").first().attr("alt")?.trim() || undefined;
    $pic.find("source[srcset]").each((__, el) => {
      for (const v of parseSrcset(base, $(el).attr("srcset")!)) {
        c.add(v.url, {
          fromPage: finalUrl,
          section,
          alt,
          width: v.w >= 100 && v.w < 10000 ? v.w : undefined,
        });
      }
    });
  });

  // --- inline svg ---------------------------------------------------------
  $("svg").each((_, el) => {
    const $el = $(el);
    // Skip trivial one-path icons that are almost always decorative chrome.
    const markup = $.html($el);
    if (!markup || markup.length < 120) return;
    const withNs = markup.includes("xmlns=")
      ? markup
      : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(withNs)}`;
    c.add(dataUrl, {
      fromPage: finalUrl,
      section: sectionOf($, el),
      alt: $el.find("title").first().text().trim() || undefined,
    });
  });

  // --- video / audio ------------------------------------------------------
  $("video").each((_, el) => {
    const $el = $(el);
    const section = sectionOf($, el);
    const poster = abs(base, $el.attr("poster") ?? "") ?? undefined;
    if (poster) c.add(poster, { fromPage: finalUrl, section, alt: "poster frame" });
    const src = $el.attr("src");
    if (src) c.add(abs(base, src), { fromPage: finalUrl, section, poster });
    $el.find("source[src]").each((__, s) => {
      c.add(abs(base, $(s).attr("src")!), { fromPage: finalUrl, section, poster });
    });
    $el.find("track[src]").each((__, s) => {
      c.add(abs(base, $(s).attr("src")!), { fromPage: finalUrl, section });
    });
  });

  // <audio> is read by the deep scan only — see the note on EXT_KIND.

  // --- icons, social images, manifest ------------------------------------
  $('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').each((_, el) => {
    c.add(abs(base, $(el).attr("href") ?? ""), { fromPage: finalUrl, section: "head" });
  });
  $('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:video"]').each(
    (_, el) => {
      c.add(abs(base, $(el).attr("content") ?? ""), { fromPage: finalUrl, section: "social" });
    },
  );

  // --- inline style backgrounds ------------------------------------------
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    if (!style.includes("url(")) return;
    extractFromCss(style, base, finalUrl, c);
  });
  $("style").each((_, el) => {
    extractFromCss($(el).text() ?? "", base, finalUrl, c);
  });

  // --- linked documents ---------------------------------------------------
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = abs(base, $(el).attr("href")!);
    if (!href || href.startsWith("data:")) return;
    const ext = extOf(href);
    if (LINKED_DOC_EXT.has(ext)) {
      c.add(href, { fromPage: finalUrl, section: sectionOf($, el) });
      return;
    }
    if (!ext || ext === "html" || ext === "htm" || ext === "php") links.push(href);
  });

  // --- scripts ------------------------------------------------------------
  $("script[src]").each((_, el) => {
    c.add(abs(base, $(el).attr("src")!), { fromPage: finalUrl, section: "head" });
  });

  // --- stylesheets: fetch and mine them ----------------------------------
  const sheets: string[] = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const u = abs(base, $(el).attr("href")!);
    if (u && !u.startsWith("data:")) sheets.push(u);
  });

  for (const u of sheets.slice(0, MAX_STYLESHEETS)) {
    c.add(u, { fromPage: finalUrl, section: "head" });
  }

  // <noscript> holds real <img> tags for lazy-loading libraries.
  $("noscript").each((_, el) => {
    const inner = $(el).text();
    if (!inner || !inner.includes("<img")) return;
    const $$ = cheerio.load(inner);
    $$("img[src]").each((__, im) => {
      c.add(abs(base, $$(im).attr("src")!), {
        fromPage: finalUrl,
        section: "noscript",
        alt: $$(im).attr("alt")?.trim() || undefined,
      });
    });
  });

  // Anything referenced only from a JSON payload or inline script.
  mineRawUrls(html, finalUrl, c);

  const fetched = await Promise.allSettled(
    sheets.slice(0, MAX_STYLESHEETS).map((u) =>
      fetchText(u, CSS_TIMEOUT_MS, MAX_CSS_BYTES).then((r) => ({ url: u, css: r.text })),
    ),
  );
  let cssFailures = 0;
  for (const r of fetched) {
    if (r.status === "fulfilled") {
      extractFromCss(r.value.css, r.value.url, finalUrl, c);
      for (const [u, fam] of extractFontFamilies(r.value.css, r.value.url)) {
        c.setFontFamily(u, fam);
      }
    } else cssFailures++;
  }
  if (cssFailures) {
    notes.push(
      `${cssFailures} stylesheet${cssFailures > 1 ? "s" : ""} could not be read, so some background images and fonts may be missing.`,
    );
  }
  if (sheets.length > MAX_STYLESHEETS) {
    notes.push(`Only the first ${MAX_STYLESHEETS} stylesheets were read.`);
  }

  return { page: { url: finalUrl, title, ok: true }, links };
}

/** Fills in byte sizes with HEAD requests, which return headers without the body. */
async function fillSizes(assets: Asset[]): Promise<void> {
  const targets = assets.filter((a) => !a.inline && a.bytes === undefined);
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const a = targets[i++];
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), HEAD_TIMEOUT_MS);
      try {
        const res = await fetch(a.url, {
          method: "HEAD",
          signal: ctrl.signal,
          redirect: "follow",
          headers: { "user-agent": UA },
        });
        const len = Number(res.headers.get("content-length") ?? 0);
        if (len > 0) a.bytes = len;
      } catch {
        /* size stays unknown — the tile shows a dash */
      } finally {
        clearTimeout(timer);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(HEAD_CONCURRENCY, targets.length) }, worker),
  );
}

export interface ScanOptions {
  /** 1 = just this page. 2 = this page plus what it links to. */
  depth?: 1 | 2;
  /** Hard ceiling on pages fetched. */
  maxPages?: number;
  /** Skip HEAD requests when speed matters more than showing file sizes. */
  skipSizes?: boolean;
}

export async function scan(rawUrl: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const started = Date.now();
  const target = assertPublicHttpUrl(rawUrl);
  const depth = opts.depth ?? 1;
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? (depth === 1 ? 1 : 12), 25));

  const notes: string[] = [];
  const collector = new Collector(target.origin);
  const pages: ScanPage[] = [];
  const seen = new Set<string>([target.toString()]);

  const first = await scanOnePage(target.toString(), collector, notes);
  pages.push(first.page);

  if (!first.page.ok) {
    throw new Error(first.page.error ?? "That page could not be loaded.");
  }

  if (depth === 2) {
    // Same-origin links only — following third-party links would be surprising.
    const queue = first.links
      .filter((l) => {
        try {
          return new URL(l).origin === target.origin;
        } catch {
          return false;
        }
      })
      .map((l) => l.split("#")[0])
      .filter((l) => !seen.has(l));

    const unique = [...new Set(queue)].slice(0, maxPages - 1);
    unique.forEach((u) => seen.add(u));

    const results = await Promise.allSettled(
      unique.map((u) => scanOnePage(u, collector, notes)),
    );
    for (const r of results) {
      if (r.status === "fulfilled") pages.push(r.value.page);
    }
    if (first.links.length > unique.length) {
      notes.push(
        `Stopped at ${pages.length} pages. Scan the whole site to go further.`,
      );
    }
  }

  const assets = collector.all();

  if (!opts.skipSizes) await fillSizes(assets);

  // Mark build artefacts and tracking pixels so the default view stays clean.
  // These are still available under the Code tab — just never mixed in with
  // the images somebody actually came for. Runs after the sizes arrive,
  // because the surest tell is the one the name never gives away: no picture
  // worth taking fits in a hundred bytes.
  for (const a of assets) {
    if (a.kind === "code") {
      a.noise = true;
      continue;
    }
    const tiny =
      (a.width !== undefined && a.width <= 2) ||
      a.bytes === 0 ||
      (a.kind === "image" && a.bytes !== undefined && a.bytes <= 100);
    const looksLikePixel = /\b(pixel|beacon|analytics|track|spacer|1x1|blank)\b/i.test(a.url);
    if (tiny || looksLikePixel) a.noise = true;
  }

  // Collapse every size of a picture onto one entry. Handles srcset families,
  // which arrive already keyed, and families we can only recognise from the
  // shape of the address.
  groupVariants(assets);

  // Readable labels, numbered within their kind so fallbacks stay distinct,
  // and de-duplicated so repeats are still tellable apart.
  assignDisplayNames(assets);

  // Most useful first: real imagery before chrome, big before small.
  const KIND_RANK: Record<string, number> = {
    image: 0, screenshot: 1, video: 2, svg: 3, model: 4, font: 5, document: 6,
    audio: 7, data: 8, code: 9,
  };
  assets.sort((x, y) => {
    if (!!x.noise !== !!y.noise) return x.noise ? 1 : -1;
    const k = (KIND_RANK[x.kind] ?? 9) - (KIND_RANK[y.kind] ?? 9);
    if (k !== 0) return k;
    return (y.bytes ?? 0) - (x.bytes ?? 0);
  });

  // A page whose pictures arrive by JavaScript looks, in the markup we read
  // here, like a page with almost no pictures and a lot of script. Reporting
  // that as a complete result is how someone ends up staring at a gallery on
  // screen and a handful of files in the list. Say what is happening instead.
  //
  // The tell is not how many pictures we found, it is where they came from.
  // These sections are the ones we synthesise when a picture was dug out of
  // embedded JSON, a meta tag or a stylesheet rather than read off a real tag
  // in the markup. A page that renders its own gallery leaves dozens of real
  // tags behind; a page that draws one after loading leaves none.
  const SYNTHETIC = new Set(["embedded", "stylesheet", "head", "social", "noscript"]);
  const scripts = assets.filter((a) => a.kind === "code" && /js/i.test(a.format)).length;
  const inMarkup = assets.filter(
    (a) =>
      !a.noise &&
      (a.kind === "image" || a.kind === "video") &&
      !SYNTHETIC.has(a.section ?? ""),
  ).length;
  if (scripts >= 8 && inMarkup < 5) {
    notes.push(
      "This page draws its images with JavaScript after loading, so they are not in the markup a quick scan reads. Run a deep scan to open the page properly and get the rest.",
    );
  }

  return {
    target: target.toString(),
    pages,
    assets,
    ms: Date.now() - started,
    notes: [...new Set(notes)],
  };
}
