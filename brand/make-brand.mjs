import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Renders the brand set from one source of truth: the tile-p mark from the
 * product, five rounded squares with the last tile missing, the one you
 * took. Light tiles for dark grounds, dark tiles for light grounds, and a
 * charcoal rounded-square app tile for the with-background set.
 */

const dir = dirname(fileURLToPath(import.meta.url));

const tiles = (fill, unit) => `
  <rect fill="${fill}" x="${5 * unit}" y="${1 * unit}" width="${6 * unit}" height="${6 * unit}" rx="${1.5 * unit}" />
  <rect fill="${fill}" x="${13 * unit}" y="${1 * unit}" width="${6 * unit}" height="${6 * unit}" rx="${1.5 * unit}" opacity="0.45" />
  <rect fill="${fill}" x="${5 * unit}" y="${9 * unit}" width="${6 * unit}" height="${6 * unit}" rx="${1.5 * unit}" opacity="0.45" />
  <rect fill="${fill}" x="${13 * unit}" y="${9 * unit}" width="${6 * unit}" height="${6 * unit}" rx="${1.5 * unit}" />
  <rect fill="${fill}" x="${5 * unit}" y="${17 * unit}" width="${6 * unit}" height="${6 * unit}" rx="${1.5 * unit}" />
`;

/** The mark alone on a transparent ground. 24-unit box, glyph inset. */
const markSvg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
${tiles(fill, 1)}
</svg>`;

/**
 * The app-tile: charcoal rounded square, light mark centred with margin.
 * 512 box; glyph drawn at 16 units/tile-grid-unit => 384 wide, centred.
 */
const bgSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#111113" />
  <g transform="translate(64, 64)">
${tiles("#fafafa", 16)}
  </g>
</svg>`;

const out = (name) => join(dir, name);
mkdirSync(dir, { recursive: true });

// SVGs
writeFileSync(out("pagehaul-mark-light.svg"), markSvg("#fafafa"));
writeFileSync(out("pagehaul-mark-dark.svg"), markSvg("#27272a"));
writeFileSync(out("pagehaul-app-tile.svg"), bgSvg());

// PNGs
const jobs = [
  ["pagehaul-mark-light.svg", "pagehaul-mark-light-1024.png", 1024],
  ["pagehaul-mark-light.svg", "pagehaul-mark-light-512.png", 512],
  ["pagehaul-mark-dark.svg", "pagehaul-mark-dark-1024.png", 1024],
  ["pagehaul-mark-dark.svg", "pagehaul-mark-dark-512.png", 512],
  ["pagehaul-app-tile.svg", "pagehaul-app-tile-1024.png", 1024],
  ["pagehaul-app-tile.svg", "pagehaul-app-tile-512.png", 512],
  ["pagehaul-app-tile.svg", "pagehaul-app-tile-192.png", 192],
  ["pagehaul-mark-dark.svg", "favicon-32.png", 32],
  ["pagehaul-app-tile.svg", "favicon-180.png", 180],
];
for (const [src, dst, size] of jobs) {
  await sharp(out(src), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(out(dst));
  console.log("wrote", dst);
}
console.log("done");
