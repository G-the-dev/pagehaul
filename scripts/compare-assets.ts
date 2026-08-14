/**
 * The comparison that matters for a downloader: how many asset URLs can be
 * found in the raw HTML, versus how many the page actually requests when run.
 */
import { launchBrowser, renderPage } from "../src/engine/render.js";
import { USER_AGENT } from "../src/engine/types.js";

const ASSET_RE =
  /(?:src|href)\s*=\s*["']([^"']+\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|woff2?|css|js))/gi;

async function main() {
  const browser = await launchBrowser();
  console.log(
    `\n  ${"site".padEnd(22)} ${"in raw html".padStart(12)} ${"requested".padStart(10)} ${"gain".padStart(7)}`,
  );
  console.log("  " + "-".repeat(56));

  for (const t of process.argv.slice(2)) {
    try {
      const res = await fetch(`https://${t.replace(/^https?:\/\//, "")}`, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
      });
      const raw = await res.text();

      const inRaw = new Set<string>();
      let m: RegExpExecArray | null;
      ASSET_RE.lastIndex = 0;
      while ((m = ASSET_RE.exec(raw))) inRaw.add(m[1]);

      const r = await renderPage(t, browser, { timeoutMs: 45_000 });
      const requested = r.requestedResources.filter((u) =>
        /\.(jpe?g|png|webp|avif|gif|svg|mp4|webm|woff2?|css|js)(\?|$)/i.test(u),
      ).length;

      const gain = inRaw.size ? `${(requested / inRaw.size).toFixed(1)}x` : "n/a";
      console.log(
        `  ${t.padEnd(22)} ${String(inRaw.size).padStart(12)} ${String(requested).padStart(10)} ${gain.padStart(7)}`,
      );
    } catch (e) {
      console.log(`  ${t.padEnd(22)} failed: ${e instanceof Error ? e.message.slice(0, 30) : e}`);
    }
  }
  console.log();
  await browser.close();
}
main();
