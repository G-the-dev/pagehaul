/**
 * Proves the browser render is worth its cost: fetches the raw HTML the server
 * sends, renders the same page in Chromium, and compares how much real content
 * each one contains.
 */
import { launchBrowser, renderPage } from "../src/engine/render.js";
import { USER_AGENT } from "../src/engine/types.js";

const TARGETS = process.argv.slice(2);

function textLength(html: string): number {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

function imgCount(html: string): number {
  return (html.match(/<img\b/gi) ?? []).length;
}

async function main() {
  const browser = await launchBrowser();
  console.log(
    `\n  ${"site".padEnd(26)} ${"raw text".padStart(9)} ${"rendered".padStart(9)}  ${"raw <img>".padStart(9)} ${"rend <img>".padStart(10)}`,
  );
  console.log("  " + "-".repeat(72));

  for (const t of TARGETS) {
    try {
      const res = await fetch(t.startsWith("http") ? t : `https://${t}`, {
        headers: { "user-agent": USER_AGENT },
        redirect: "follow",
      });
      const raw = await res.text();
      const rendered = await renderPage(t, browser, { timeoutMs: 40_000 });

      const host = new URL(rendered.finalUrl).hostname.replace(/^www\./, "");
      console.log(
        `  ${host.padEnd(26)} ${String(textLength(raw)).padStart(9)} ${String(textLength(rendered.html)).padStart(9)}  ${String(imgCount(raw)).padStart(9)} ${String(imgCount(rendered.html)).padStart(10)}`,
      );
    } catch (e) {
      console.log(`  ${t.padEnd(26)} failed: ${e instanceof Error ? e.message.slice(0, 40) : e}`);
    }
  }
  console.log();
  await browser.close();
}

main();
