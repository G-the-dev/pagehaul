/**
 * Deep-scans a three.js-heavy site and reports every 3D-adjacent asset:
 * sniffed three.js JSON models, classic model files, and GPU textures.
 *
 *   npx tsx scripts/test-3d.ts [url]
 */
import { deepScan } from "../src/lib/deepscan";

const target = process.argv[2] ?? "https://lisa.locomotive.ca/en";

async function main() {
  const r = await deepScan(target);
  const models = r.assets.filter((a) => a.kind === "model");
  const textures = r.assets.filter((a) => /\.(hdr|exr|ktx2|basis|dds)(\?|$)/i.test(a.url));
  console.log(`assets: ${r.assets.length} | models: ${models.length} | gpu textures: ${textures.length} | ms: ${r.ms}`);
  for (const a of models) console.log("  MODEL", a.format, a.displayName, "-", a.url.slice(0, 110));
  for (const a of textures.slice(0, 8)) console.log("  TEX  ", a.format, a.displayName, "-", a.url.slice(0, 110));
  const jsonish = r.assets.filter((a) => a.kind === "api" && /json/i.test(a.format ?? ""));
  console.log("json network calls:", jsonish.length);
  for (const a of jsonish.slice(0, 10)) console.log("  API  ", a.url.slice(0, 110), "|", (a.preview ?? "").slice(0, 60));
  process.exit(0);
}
main();
