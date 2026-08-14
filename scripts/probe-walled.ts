/** What do login walled sites actually serve to a browser with no session? */
import { launchBrowser, renderPage } from "../src/engine/render.js";

const TARGETS = ["https://x.com/Uniswap/media", "https://www.instagram.com/nasa/"];

async function main() {
  const browser = await launchBrowser();
  for (const t of TARGETS) {
    try {
      const r = await renderPage(t, browser, { timeoutMs: 40_000 });
      const media = r.requestedResources.filter((u) =>
        /\.(jpe?g|png|webp|mp4|gif)(\?|$)/i.test(u),
      );
      const text = r.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const wall = /log ?in|sign ?up|create account/i.test(text.slice(0, 3000));
      console.log(`\n  ${t}`);
      console.log(`    status ${r.status} | title ${JSON.stringify(r.title.slice(0, 40))}`);
      console.log(`    media files requested: ${media.length}`);
      console.log(`    login wall in first screen of text: ${wall ? "YES" : "no"}`);
    } catch (e) {
      console.log(`\n  ${t}\n    failed: ${e instanceof Error ? e.message.slice(0, 70) : e}`);
    }
  }
  await browser.close();
}
main();
