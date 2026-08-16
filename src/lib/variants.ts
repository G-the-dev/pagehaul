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

  // A filename that is nothing but a dimension — 960x720.mp4, 540x960.webp —
  // is a size, not an identity. Recent.design and other CDNs name every size
  // of one video this way (/items/<id>/0/960x720.mp4), so the identity is the
  // path that leads to it. Drop the filename and key on the path.
  if (/^\d{2,4}x\d{2,4}$/.test(stem)) {
    if (!keptSegments.length) return undefined;
    return `${u.host}/${keptSegments.join("/")}`;
  }

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

  // A filename that is purely a dimension: 960x720.mp4 — take the larger side,
  // since a portrait 540x960 and a landscape 960x540 are both "960 across the
  // long edge".
  const bare = /\/(\d{2,4})x(\d{2,4})\.[a-z0-9]+$/i.exec(u.pathname);
  if (bare) best = Math.max(best, Number(bare[1]), Number(bare[2]));

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

/**
 * The same picture, asked for at a size a tile can actually use.
 *
 * A grid tile is around two hundred pixels wide, and we were filling it with
 * whatever the page happened to reference — a 2240 pixel JPEG in one case, 494
 * kilobytes of it, for a thumbnail. Forty-eight of those is nearly two
 * megabytes to draw one screen.
 *
 * Only knobs the address already exposes are touched, and only downwards, so
 * this can never ask for something the CDN was not already offering. Returns
 * null when the address says nothing about size, in which case the original is
 * the only option.
 */
const THUMB_PX = 400;

/**
 * Hosts whose resize knob is not the obvious one.
 *
 * Framer's URLs carry ?width= and ?height=, which look like a resize request
 * and are nothing of the kind — they are the intrinsic dimensions, and the CDN
 * ignores them. Measured on one file: no parameters, 692,660 bytes;
 * ?width=400, 692,660 bytes; ?scale-down-to=512, 35,429 bytes. Guessing from
 * the parameter names alone would have left a twenty-fold saving on the table
 * and, worse, produced a URL that looked downscaled while serving the original.
 */
const RESIZE_PARAM_BY_HOST: [RegExp, string][] = [
  [/(?:^|\.)framerusercontent\.com$/i, "scale-down-to"],
];

export function thumbnailUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  // A signed URL is a promise that exactly these parameters were authorised.
  // Change one and the CDN answers 403 — pentagram's imgix does precisely
  // that — so a signed address is served as-is or not at all.
  for (const key of u.searchParams.keys()) {
    if (/^(?:s|sig|signature|token|hmac|policy|x-amz-signature)$/i.test(key)) {
      return null;
    }
  }

  for (const [host, param] of RESIZE_PARAM_BY_HOST) {
    if (!host.test(u.hostname)) continue;
    const current = Number(u.searchParams.get(param));
    if (Number.isFinite(current) && current > 0 && current <= THUMB_PX) return null;
    u.searchParams.set(param, String(THUMB_PX));
    return u.toString();
  }

  let touched = false;

  // Query knobs: ?width=2240, ?w=1500, ?scale-down-to=1024.
  let ratio = 1;
  for (const [key, value] of [...u.searchParams]) {
    if (!/^(?:w|width|scale-down-to|size|max-?w(?:idth)?)$/i.test(key)) continue;
    const current = Number(value);
    if (!Number.isFinite(current) || current <= THUMB_PX) continue;
    ratio = Math.min(ratio, THUMB_PX / current);
    u.searchParams.set(key, String(THUMB_PX));
    touched = true;
  }

  // Scale the height with it rather than dropping it. Removing the height from
  // a width/height pair made Framer ignore the request and hand back the
  // original — 585KB for a thumbnail, worse than doing nothing.
  if (touched && ratio < 1) {
    for (const [key, value] of [...u.searchParams]) {
      if (!/^(?:h|height|max-?h(?:eight)?)$/i.test(key)) continue;
      const current = Number(value);
      if (!Number.isFinite(current) || current <= 0) continue;
      u.searchParams.set(key, String(Math.max(1, Math.round(current * ratio))));
    }
  }

  // Path segments that are a size: Pinterest's /736x/ and /originals/.
  if (!touched) {
    const parts = u.pathname.split("/");
    for (let i = 0; i < parts.length; i++) {
      const m = /^(\d{3,4})x$/i.exec(parts[i]);
      if (m && Number(m[1]) > THUMB_PX) {
        parts[i] = `${THUMB_PX}x`;
        touched = true;
      } else if (/^originals?$/i.test(parts[i])) {
        parts[i] = `${THUMB_PX}x`;
        touched = true;
      }
    }
    if (touched) u.pathname = parts.join("/");
  }

  return touched ? u.toString() : null;
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

/** Full dimensions read out of a URL, for labelling one size among a family. */
function dimsFromUrl(rawUrl: string): string | null {
  try {
    const m = /\/(\d{2,4})x(\d{2,4})\.[a-z0-9]+(?:\?|$)/i.exec(new URL(rawUrl).pathname);
    return m ? `${m[1]}x${m[2]}` : null;
  } catch {
    return null;
  }
}

/**
 * What to call a size in a list of sizes.
 *
 * Full WxH when we can get it, because a family can hold different aspect
 * ratios — a 960x720 landscape and a 540x960 portrait of the same video — and a
 * bare "960px" cannot tell those apart.
 */
function variantLabel(a: Groupable): string {
  if (a.width && a.height) return `${a.width}x${a.height}`;
  const dims = dimsFromUrl(a.url);
  if (dims) return dims;
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
/** A tile is ~200px wide; anything under this renders as a colour swatch. */
const MIN_THUMB_PX = 180;

/**
 * The width an address is really asking for.
 *
 * Differs from sizeHint on one point that matters here: an explicit resize
 * parameter beats everything else. sizeHint takes the most optimistic signal
 * it can find, so a placeholder called photo_1080x608.gif?w=32 scores 1080 —
 * the filename describes the source, but the ?w=32 describes what the CDN
 * will actually send back, and that is the one a thumbnail cares about.
 */
function claimedWidth(rawUrl: string): number {
  try {
    const u = new URL(rawUrl);
    for (const key of ["w", "width", "scale-down-to"]) {
      const v = Number(u.searchParams.get(key));
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch {
    /* fall through */
  }
  return sizeHint(rawUrl);
}

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

  // Vet every thumb regardless of where it was assigned. They arrive from the
  // srcset reader, from an earlier grouping pass, and from merging two scans,
  // and policing each inflow separately is how a 32px placeholder kept
  // slipping back in. One rule, applied last, at the door.
  for (const a of assets) {
    if (a.thumbUrl && claimedWidth(a.thumbUrl) < MIN_THUMB_PX) {
      a.thumbUrl = undefined;
    }
  }

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

    // The cheapest thing to show while browsing that is still recognisable.
    //
    // "Smallest variant" was the rule here, and pentagram.com showed why that
    // is wrong: pages ship 20-32px blurred placeholder variants in their
    // payloads, and a tile drawn from one is a rectangle of solid colour. So
    // the smallest variant that can still fill a ~200px tile wins, and when
    // every small variant is a placeholder the thumb stays unset — the tile
    // then derives its own downscale from the full-size address instead.
    if (!best.thumbUrl) {
      const adequate = [...ordered]
        .reverse()
        .find((a) => a !== best && claimedWidth(a.url) >= MIN_THUMB_PX);
      if (adequate) best.thumbUrl = adequate.url;
    }
  }
}
