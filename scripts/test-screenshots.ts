/**
 * Checks that a deep scan returns screenshots of the page and its sections.
 *
 * The shots travel as data URLs inside the scan's JSON, so the test also
 * holds the total against the response budget — a scan that screenshots
 * beautifully but cannot fit through the platform's response cap ships
 * nothing at all.
 *
 *   npx tsx scripts/test-screenshots.ts [url]
 *
 * Set SHOT_DUMP to a directory to write each capture out as a .jpg for a
 * visual check.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deepScan } from "../src/lib/deepscan";

const target = process.argv[2] ?? "https://portfolio-rits.vercel.app/";

async function main() {
  const r = await deepScan(target);
  const shots = r.assets.filter((a) => a.kind === "screenshot");
  const chars = shots.reduce((n, a) => n + a.url.length, 0);
  console.log(
    `deep scan: ${r.assets.length} assets, ${shots.length} screenshots, ` +
      `${(chars / 1e6).toFixed(2)}M chars of data URL, ${r.ms}ms`,
  );
  for (const a of shots) {
    console.log(
      `  ${String(a.width).padStart(5)}x${String(a.height).padEnd(6)} ` +
        `${String(Math.round((a.bytes ?? 0) / 1024)).padStart(4)}KB  ${a.displayName}`,
    );
  }

  if (process.env.SHOT_DUMP) {
    shots.forEach((a, i) => {
      const b64 = a.url.slice(a.url.indexOf(",") + 1);
      const file = join(process.env.SHOT_DUMP!, `shot-${i}.jpg`);
      writeFileSync(file, Buffer.from(b64, "base64"));
      console.log(`  wrote ${file}`);
    });
  }

  const pass = shots.length >= 2 && chars <= 3_600_000;
  console.log(
    pass
      ? "\nPASS  screenshots captured within the response budget"
      : shots.length < 2
        ? "\nFAIL  expected at least a full-page shot and one section"
        : "\nFAIL  screenshots overran the response budget",
  );
  process.exit(pass ? 0 : 1);
}

main();
