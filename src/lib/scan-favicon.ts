/**
 * The favicon scans while the scanner does.
 *
 * The mark is five tiles and a gap — a sliding puzzle waiting to slide. For
 * the length of a scan the gap steps clockwise around the grid, one cell at
 * a time, and the tab reads as working even from another tab, which is
 * exactly where a person waiting on a deep scan may be. When the scan ends
 * the real icon returns, whole.
 *
 * Frames are data-URL SVGs swapped onto the icon links; the geometry and the
 * theme-following greys match icon.svg exactly, so the first frame is
 * indistinguishable from the mark at rest.
 */

const COLS = [7.5, 17.5];
const ROWS = [2.5, 12.5, 22.5];
/** Cell ring in clockwise order: TL, TR, MR, BR, BL, ML. */
const RING: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [1, 2],
  [0, 2],
  [0, 1],
];
/** The mark's own gap is bottom-right; the spin starts from home. */
const HOME_GAP = 3;

function frame(gap: number): string {
  const rects = RING.filter((_, i) => i !== gap)
    .map(([c, r]) => {
      const dim = (c + r) % 2 === 1;
      return `<rect class="t" x="${COLS[c]}" y="${ROWS[r]}" width="7" height="7" rx="2"${dim ? ' opacity=".5"' : ""}/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.t{fill:#52525b}@media(prefers-color-scheme:dark){.t{fill:#d4d4d8}}</style>${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

let frames: string[] | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let originals: { el: HTMLLinkElement; href: string }[] | null = null;

export function startFaviconSpin(): void {
  if (timer) return;
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"),
  );
  if (!links.length) return;

  frames ??= RING.map((_, i) => frame((HOME_GAP + i) % RING.length));
  originals = links.map((el) => ({ el, href: el.href }));

  let step = 0;
  const tick = () => {
    step = (step + 1) % frames!.length;
    for (const { el } of originals!) el.href = frames![step];
  };
  // A calm cadence; background tabs throttle timers to a second anyway,
  // and even at that pace the tab still visibly works.
  timer = setInterval(tick, 450);
  tick();
}

export function stopFaviconSpin(): void {
  clearInterval(timer);
  timer = undefined;
  if (originals) {
    for (const { el, href } of originals) el.href = href;
    originals = null;
  }
}
