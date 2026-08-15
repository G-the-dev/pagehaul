import { looksLikeTransform } from "./naming";
/**
 * Recognising the same picture at different sizes.
 *
 * A CDN almost never serves one address per picture. It serves a family:
 * Pinterest puts the size in a path segment (/236x/, /474x/, /736x/,
 * /originals/), WordPress appends it to the filename (photo-150x150.jpg),
 * image services put it in the query (?w=800&h=600), and retina variants add
 * @2x. All of these are the same photograph.
 *
 * Left alone, a page holding forty pictures reports two hundred files, most of
 * them the same picture nine times, and the one somebody wants is buried. So we
 * work out which addresses belong together, keep the largest as the one on
 * show, and hang the rest off it as sizes to choose from.
 */

/**
 * Path segments that describe a size rather than a location, so two addresses
 * differing only here are the same picture.
 */
const SIZE_SEGMENT =
  /^(?:\d{2,4}x(?:\d{2,4})?(?:_RS)?|originals?|orig|full|raw|thumbs?|thumbnails?|small|medium|large|xlarge|preview|resize|scaled?|[whcqfd]_\d+|[whcq]_[a-z]+|s\d{2,4}(?:-c)?|fit-in)$/i;

/** Suffixes a file name picks up when it is a resize of another file. */
const SIZE_SUFFIX =
  /(?:[-_](?:\d{2,4}x\d{2,4}|\d{2,4}w|\d{2,4}h)|@[23]x|[-_](?:thumb|thumbnail|small|medium|large|scaled|mini|tiny|preview))+$/i;

/**
 * Query keys that only change the rendering of an otherwise identical file.
 *
 * Matched loosely as well as exactly, because services invent their own names
 * for the same idea: Framer asks for ?scale-down-to=512, which is a size by any
 * reading, and treating it as identity split every picture on that site into
 * one family per size.
 */
const SIZE_PARAM =
  /^(?:w|h|width|height|size|s|q|quality|dpr|fit|crop|fm|auto|format|resize|rect|ixlib|ixid|cs|blur|sharp|tr|lossless|compress|density|zoom)$/i;
const SIZE_PARAM_LOOSE = /(?:width|height|scale|size|quality|format|resize|dpr|crop|fit)/i;

/**
 * A key shared by every size of one picture, or undefined when the address
 * carries nothing we can group on.
 *
 * Deliberately conservative about the path: only segments that clearly describe
 * a size are dropped, so /brand/logo.png and /product/logo.png stay apart.
 */
export function variantFamily(rawUrl: string): string | undefined {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;

  const segments = u.pathname.split("/").filter(Boolean);
  if (!segments.length) return undefined;

  let file = segments.pop()!;

  // Some CDNs end the path with rendering options rather than a filename:
  // /imagedelivery/<account>/<image-id>/f=auto,fit=scale-down,width=2560.
  // The options are the size, so drop them and let the id identify the picture.
  while (segments.length && looksLikeTransform(file)) {
    file = segments.pop()!;
  }

  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot + 1).toLowerCase() : "";

  const keptSegments = segments.filter((s) => !SIZE_SEGMENT.test(s));
  const keptStem = stem.replace(SIZE_SUFFIX, "");

  // A name that was nothing but a size marker is not something to group on.
  if (!keptStem) return undefined;

  // Keep query parameters that identify the file, drop the ones that only
  // describe how to render it. Sorted so parameter order cannot split a family.
  const params: string[] = [];
  u.searchParams.forEach((value, key) => {
    if (SIZE_PARAM.test(key) || SIZE_PARAM_LOOSE.test(key)) return;
    params.push(`${key}=${value}`);
  });
  params.sort();

  const path = [...keptSegments, keptStem].join("/");
  return `${u.host}/${path}${ext ? `.${ext}` : ""}${params.length ? `?${params.join("&")}` : ""}`;
}

/**
 * How large an address claims to be, read from the address itself.
 *
 * Needed because a picture named in a payload was never fetched, so there is no
 * byte count and no decoded width to compare. The number in /736x/ or in
 * ?w=1200 is the only evidence available, and it is usually accurate.
 */
export function sizeHint(rawUrl: string): number {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return 0;
  }

  // Words that mean "the untouched upload" outrank any explicit number.
  if (/\/(?:originals?|orig|full|raw|source)\//i.test(u.pathname)) return 100_000;

  let best = 0;
  for (const seg of u.pathname.split("/")) {
    const m = /^(\d{2,4})x(?:\d{2,4})?(?:_RS)?$/i.exec(seg);
    if (m) best = Math.max(best, Number(m[1]));
  }
  const suffix = /[-_](\d{2,4})(?:x\d{2,4}|w)(?:\.[a-z0-9]+)?$/i.exec(u.pathname);
  if (suffix) best = Math.max(best, Number(suffix[1]));

  // Options written into the path, e.g. .../f=auto,width=2560 or .../w_800.
  for (const m of u.pathname.matchAll(/\b(?:width|w|h|height)[=_-](\d{2,5})\b/gi)) {
    best = Math.max(best, Number(m[1]));
  }

  u.searchParams.forEach((value, key) => {
    if (!SIZE_PARAM.test(key) && !SIZE_PARAM_LOOSE.test(key)) return;
    // Only width-ish keys carry a number worth ranking on.
    if (/height|quality|dpr|format|fit|crop/i.test(key)) return;
    const v = Number(value);
    if (Number.isFinite(v) && v > 0) best = Math.max(best, v);
  });
  if (/@3x\./i.test(u.pathname)) best = Math.max(best, 3);
  else if (/@2x\./i.test(u.pathname)) best = Math.max(best, 2);

  return best;
}

interface Groupable {
  url: string;
  kind: string;
  width?: number;
  height?: number;
  bytes?: number;
  variantKey?: string;
  isLargest?: boolean;
  variantCount?: number;
  variants?: { url: string; label: string; bytes?: number }[];
  thumbUrl?: string;
}

/** What to call a size in a list of sizes: real dimensions if we have them. */
function variantLabel(a: Groupable): string {
  if (a.width && a.height) return `${a.width}x${a.height}`;
  if (a.width) return `${a.width}px`;
  const hint = sizeHint(a.url);
  if (hint === 100_000) return "original";
  if (hint > 3) return `${hint}px`;
  if (hint === 2 || hint === 3) return `@${hint}x`;
  return "other size";
}

/**
 * Sizes worth offering, out of however many the CDN happens to publish.
 *
 * Pinterest exposes about thirty rungs of a resize ladder for one photograph,
 * several of them the same width by different routes. Listing all of it fills
 * four rows with chips reading 400px, 400px, 200px, 200px, 70px, 70px and
 * answers a question nobody asked: what is wanted is the real file, and
 * occasionally something small enough to use as a thumbnail.
 *
 * So: drop duplicates, then keep the largest, the smallest, and a couple spread
 * between them.
 */
const MAX_OFFERED = 4;

function chooseOfferedSizes(
  ordered: Groupable[],
): { url: string; label: string; bytes?: number }[] {
  const seen = new Set<string>();
  const unique: Groupable[] = [];
  for (const a of ordered) {
    const label = variantLabel(a);
    if (seen.has(label)) continue;
    seen.add(label);
    unique.push(a);
  }

  const pick =
    unique.length <= MAX_OFFERED
      ? unique
      : Array.from({ length: MAX_OFFERED }, (_, i) =>
          // Evenly spaced, so the ends are always the true largest and smallest.
          unique[Math.round((i * (unique.length - 1)) / (MAX_OFFERED - 1))],
        );

  return pick.map((a) => ({
    url: a.url,
    label: variantLabel(a),
    bytes: a.bytes,
  }));
}

/**
 * Groups an asset list into families and marks the best of each.
 *
 * Only pictures are grouped. Two stylesheets that differ by a number in the
 * name are two stylesheets, and collapsing them would hide real files.
 *
 * Anything already grouped by a real srcset keeps that grouping, because the
 * markup saying so is better evidence than a guess from the address.
 */
export function groupVariants(assets: Groupable[]): void {
  const families = new Map<string, Groupable[]>();

  for (const a of assets) {
    if (a.kind !== "image" && a.kind !== "video") continue;
    const key = a.variantKey ?? variantFamily(a.url);
    if (!key) continue;
    a.variantKey = key;
    const list = families.get(key);
    if (list) list.push(a);
    else families.set(key, [a]);
  }

  for (const list of families.values()) {
    if (list.length === 1) {
      // A family of one is just a picture. Leave it unmarked so the UI has
      // nothing to explain.
      list[0].variantKey = undefined;
      list[0].isLargest = undefined;
      continue;
    }

    // Both kinds of evidence are widths, so compare them as widths.
    //
    // Weighting measured pixels above the address put a 474px copy ahead of the
    // untouched original, because the original was never rendered and scored
    // zero on the term that dominated. Whichever source claims more wins, and
    // bytes only settle a tie.
    const score = (a: Groupable) =>
      Math.max(a.width ?? 0, sizeHint(a.url)) * 1_000 + (a.bytes ?? 0) / 1_000;

    const ordered = [...list].sort((x, y) => score(y) - score(x));
    for (const a of ordered) a.isLargest = false;

    const best = ordered[0];
    best.isLargest = true;
    best.variantCount = ordered.length;
    best.variants = chooseOfferedSizes(ordered);

    // The smallest is the cheapest thing to show while browsing.
    const worst = ordered[ordered.length - 1];
    if (!best.thumbUrl && worst !== best) best.thumbUrl = worst.url;
  }
}
