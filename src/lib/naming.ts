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
};

/**
 * The label shown on the tile. Falls back through alt text, a cleaned filename,
 * the font family, and finally a positional description, so a tile is never
 * labelled with a bare hash.
 */
export function displayNameFor(
  a: Pick<Asset, "kind" | "name" | "alt" | "section" | "format" | "fontFamily">,
  indexWithinKind: number,
): string {
  if (a.kind === "font" && a.fontFamily) {
    return a.fontFamily;
  }

  const alt = a.alt ? fromAlt(a.alt) : null;
  if (alt) return alt;

  const stripped = stripHashSuffix(a.name);
  if (!isOpaqueName(stripped)) {
    return titleCase(stripped);
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
