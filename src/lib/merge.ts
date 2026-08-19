import type { Asset, ScanResult } from "./types";
import { assignDisplayNames } from "./naming";
import { groupVariants } from "./variants";

/**
 * Combines a deep scan with a static read of the same page.
 *
 * The two see different things and neither contains the other. A browser
 * reports what it actually fetched, so it never mentions the four srcset
 * candidates it did not pick, and inline SVG never crosses the network at all.
 * Reading the markup reports what is declared, so it misses everything drawn
 * after load. On framer.com the static read alone held 115 files the browser
 * never saw, 91 of them icons.
 *
 * Somebody choosing "deep" is asking for more, not for different, so deep is
 * made a superset by running both and merging.
 */
export function mergeScans(deep: ScanResult, quick: ScanResult): ScanResult {
  const byUrl = new Map<string, Asset>();

  // The browser's record wins on conflict: it carries the status, the byte
  // count and the content type, none of which a static read can know.
  for (const a of deep.assets) byUrl.set(a.url, a);

  // Screenshots are captures rather than addresses, so two scans' shots of
  // the same page are byte-different and would both survive a URL merge —
  // every section twice. The primary's captures stand; the secondary's only
  // fill in when the primary has none at all.
  const primaryHasShots = deep.assets.some((a) => a.kind === "screenshot");

  for (const a of quick.assets) {
    if (a.kind === "screenshot" && primaryHasShots) continue;
    const existing = byUrl.get(a.url);
    if (!existing) {
      byUrl.set(a.url, { ...a });
      continue;
    }
    // Same file seen twice: keep the deep record but take any detail the
    // markup knew and the network could not tell us.
    existing.alt ??= a.alt;
    existing.section ??= a.section;
    existing.width ??= a.width;
    existing.height ??= a.height;
    existing.fontFamily ??= a.fontFamily;
    existing.thumbUrl ??= a.thumbUrl;
  }

  const assets = [...byUrl.values()];

  // Both inputs were grouped and numbered against their own list, so both are
  // now wrong for the combined one. Redo them.
  for (const a of assets) {
    a.variantKey = undefined;
    a.isLargest = undefined;
    a.variantCount = undefined;
    a.variants = undefined;
  }
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

  // The static read tells people to run a deep scan when a page draws itself
  // with JavaScript. Perfectly good advice on its own, and nonsense here — this
  // *is* the deep scan, and the browser half already did what it was asking for.
  const quickNotes = quick.notes.filter((n) => !/run a deep scan/i.test(n));

  return {
    ...deep,
    assets,
    // Design reads are skippable under time pressure, and a scan that
    // skipped one must not erase what an earlier scan captured. Fuller wins.
    palette:
      (deep.palette?.length ?? 0) >= (quick.palette?.length ?? 0)
        ? deep.palette
        : quick.palette,
    typography:
      (deep.typography?.length ?? 0) >= (quick.typography?.length ?? 0)
        ? deep.typography
        : quick.typography,
    tokens:
      (deep.tokens?.length ?? 0) >= (quick.tokens?.length ?? 0)
        ? deep.tokens
        : quick.tokens,
    notes: [...new Set([...deep.notes, ...quickNotes])],
  };
}
