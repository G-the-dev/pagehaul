import type { Asset, AssetKind } from "./types";

/**
 * CDNs name files by content hash, so the filename is usually meaningless to a
 * person. These helpers work out whether a name carries information and, when it
 * does not, build a readable label from whatever context we do have.
 */

const HEX_ONLY = /^[0-9a-f]{12,}$/i;
const HASH_SUFFIX = /^(.*?)[-_.][0-9a-f]{8,}$/i;
const BASE64ISH = /^[A-Za-z0-9_-]{22,}$/;

/** True when a filename is a hash, id, or otherwise tells a person nothing. */
export function isOpaqueName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (HEX_ONLY.test(n)) return true;

  // No vowels across a long string is a strong hash signal.
  if (n.length >= 14 && !/[aeiou]/i.test(n)) return true;

  if (BASE64ISH.test(n)) {
    // Real words are rare in base64-ish strings; digits and case churn are common.
    const digits = (n.match(/\d/g) ?? []).length;
    const caseFlips = (n.match(/(?:[a-z][A-Z]|[A-Z][a-z])/g) ?? []).length;
    if (digits / n.length > 0.25 || caseFlips > 4) return true;
  }
  return false;
}

/**
 * Keys that appear in an image CDN's transformation spec.
 *
 * Cloudflare writes it as a path segment (f=auto,fit=scale-down,width=2560),
 * Cloudinary as w_800,h_600,c_fill, ImageKit as tr:w-300. In every case it
 * describes how to render the picture, not which picture it is, and reading it
 * as a filename is how a tile ends up labelled "F=Auto,Fit=Scale Down".
 */
const TRANSFORM_KEY =
  /^(?:f|fm|fit|format|q|quality|w|width|h|height|dpr|c|crop|g|gravity|e|effect|bg|background|metadata|auto|rs|tr|sharpen|blur|rot|rotate|trim|ar|z|zoom|s|size|anim|onerror|compress)$/i;

/** True when a path segment is rendering instructions rather than a name. */
export function looksLikeTransform(segment: string): boolean {
  const seg = segment.trim();
  if (!seg || seg.includes(".")) return false;

  const parts = seg.split(",");
  let recognised = 0;
  for (const part of parts) {
    const m = /^([a-z][a-z0-9]{0,11})[=_:-]/i.exec(part);
    // Every part has to be a key/value pair for this to be a spec at all.
    if (!m) return false;
    if (TRANSFORM_KEY.test(m[1])) recognised++;
  }

  // One pair only counts when we recognise the key, otherwise "report-2024"
  // would be mistaken for a transformation.
  return parts.length > 1
    ? recognised >= Math.ceil(parts.length / 2)
    : recognised === 1;
}

const UUIDISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for machine identifiers: account keys, asset ids, UUIDs.
 *
 * Stricter than isOpaqueName, which only has to decide whether a filename is
 * worth showing. Here we are choosing between an identifier and a real word,
 * and "fO02fVwohEs9s9UHFwon6A" slips past a digit-ratio test while being
 * obviously not a name.
 */
function looksLikeIdentifier(s: string): boolean {
  if (UUIDISH.test(s)) return true;
  // Long, unbroken, and carrying digits: nothing a person would write.
  if (s.length >= 16 && /\d/.test(s) && !/[-_ ]/.test(s)) return true;
  const flips = (s.match(/(?:[a-z][A-Z]|[A-Z][a-z])/g) ?? []).length;
  if (s.length >= 12 && flips >= 3 && /\d/.test(s)) return true;
  return false;
}

/** Segments that are structure rather than identity, skipped when naming. */
const PLUMBING_SEGMENT =
  /^(?:images?|img|assets?|static|media|uploads?|files?|content|public|cdn|cdn-cgi|imagedelivery|image|photos?|thumbs?|resize|fit-in|v\d+|\d+|originals?)$/i;

/**
 * The most name-like segment of a URL path, read from the end backwards.
 *
 * Used when the last segment turns out to be a transformation spec or a hash,
 * because the segment before it is often the real one.
 */
export function labelFromPath(rawUrl: string): string | null {
  let segments: string[];
  try {
    segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = decodeURIComponent(segments[i]);
    if (looksLikeTransform(seg)) continue;
    if (PLUMBING_SEGMENT.test(seg)) continue;

    const dot = seg.lastIndexOf(".");
    const stem = dot > 0 ? seg.slice(0, dot) : seg;
    if (looksLikeIdentifier(stem)) continue;
    const cleaned = stripHashSuffix(stem);
    if (cleaned.length >= 3 && !isOpaqueName(cleaned) && !looksLikeIdentifier(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/** Drops a trailing build hash: "gestalt-2ce0b1a3" becomes "gestalt". */
export function stripHashSuffix(name: string): string {
  const m = HASH_SUFFIX.exec(name);
  if (m && m[1] && m[1].length >= 3 && !isOpaqueName(m[1])) return m[1];
  return name;
}

function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Trims alt text down to something that reads as a label rather than a sentence. */
function fromAlt(alt: string): string | null {
  const a = alt.trim().replace(/\s+/g, " ");
  if (!a || a.length < 2) return null;
  if (a.length > 52) return `${a.slice(0, 49).trimEnd()}…`;
  return a;
}

const KIND_NOUN: Record<AssetKind, string> = {
  image: "Image",
  svg: "Icon",
  video: "Video",
  audio: "Audio",
  font: "Font",
  document: "Document",
  code: "Script",
  data: "Data",
  api: "Request",
};

/**
 * The label shown on the tile. Falls back through alt text, a cleaned filename,
 * the font family, and finally a positional description, so a tile is never
 * labelled with a bare hash.
 */
export function displayNameFor(
  a: Pick<Asset, "kind" | "name" | "alt" | "section" | "format" | "fontFamily" | "url">,
  indexWithinKind: number,
): string {
  if (a.kind === "font" && a.fontFamily) {
    return a.fontFamily;
  }

  const alt = a.alt ? fromAlt(a.alt) : null;
  if (alt) return alt;

  const stripped = stripHashSuffix(a.name);
  if (!isOpaqueName(stripped) && !looksLikeTransform(a.name)) {
    return titleCase(stripped);
  }

  // The last segment was a hash or a set of rendering options. Somewhere
  // earlier in the path there is often a real name.
  if (a.url) {
    const fromPath = labelFromPath(a.url);
    if (fromPath) return titleCase(fromPath);
  }

  // Nothing usable in the name — describe it by where it sits instead.
  const noun = KIND_NOUN[a.kind];
  if (a.section && a.section !== "stylesheet" && a.section !== "head") {
    return `${titleCase(a.section)} ${noun.toLowerCase()} ${indexWithinKind}`;
  }
  return `${noun} ${indexWithinKind}`;
}

/** Filename used on download — readable, but still carrying the real extension. */
export function downloadNameFor(a: Asset): string {
  const ext = a.format.toLowerCase();
  const base = (a.displayName || a.name)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
  const safe = base || a.kind;
  return safe.endsWith(`.${ext}`) ? safe : `${safe}.${ext}`;
}
