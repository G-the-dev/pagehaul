/**
 * Checks that a deep scan finds audio a page only speaks of in its code.
 *
 * The reference case is a portfolio that plays a sound on hover through the
 * Web Audio API: the file is fetched on mouseover (never during a scan) and
 * builds no <audio> element, so the only trace is "/sounds/tap.mp3" written
 * in a bundle. A deep scan must list it anyway; a quick scan must not claim
 * to — code-mined audio is deep-only.
 *
 *   npx tsx scripts/test-audio.ts [url]
 */
import { deepScan } from "../src/lib/deepscan";
import { scan } from "../src/lib/scan";

const target = process.argv[2] ?? "https://portfolio-rits.vercel.app/";

async function main() {
  const deep = await deepScan(target);
  const deepAudio = deep.assets.filter((a) => a.kind === "audio");
  console.log(`deep scan: ${deep.assets.length} assets, ${deepAudio.length} audio, ${deep.ms}ms`);
  for (const a of deepAudio) {
    console.log(`  ${a.format.padEnd(5)} ${a.displayName.padEnd(24)} ${a.bytes ?? "?"} B  ${a.url}`);
  }

  const quick = await scan(target);
  const quickAudio = quick.assets.filter((a) => a.kind === "audio");
  console.log(`quick scan: ${quick.assets.length} assets, ${quickAudio.length} audio`);

  const pass = deepAudio.length > 0 && quickAudio.length === 0;
  console.log(
    pass
      ? "\nPASS  audio is listed by the deep scan alone"
      : deepAudio.length === 0
        ? "\nFAIL  deep scan found no audio"
        : "\nFAIL  quick scan listed audio, which is deep-scan territory",
  );
  process.exit(pass ? 0 : 1);
}

main();
