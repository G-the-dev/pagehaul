/** Captures a page, rewrites it, and checks the result needs no internet. */
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchBrowser, renderPage } from "../src/engine/render.js";
import { downloadAssets } from "../src/engine/download.js";
import { rewriteCss, rewriteHtml } from "../src/engine/rewrite.js";
import { urlToLocalPath } from "../src/engine/paths.js";
import { LIMITS } from "../src/config/limits.js";

async function main() {
  const target = process.argv[2] ?? "https://example.com";
  const work = await mkdtemp(join(tmpdir(), "ph-off-"));
  const browser = await launchBrowser();
  try {
    const page = await renderPage(target, browser, { timeoutMs: LIMITS.pageTimeoutMs });
    const dl = await downloadAssets(page.requestedResources, work, {
      maxJobBytes: LIMITS.maxJobBytes,
      maxAssetBytes: LIMITS.maxAssetBytes,
      timeoutMs: LIMITS.assetTimeoutMs,
      concurrency: LIMITS.assetConcurrency,
    });

    const savedUrls = new Set(dl.saved.map((a) => a.url));
    const savedPages = new Set([page.finalUrl]);

    for (const a of dl.saved) {
      if (!/\.css(\?|$)/i.test(a.url)) continue;
      const f = join(work, a.localPath);
      const css = await readFile(f, "utf8");
      await writeFile(f, rewriteCss(css, { baseUrl: a.url, fromPath: a.localPath, savedUrls, savedPages }), "utf8");
    }

    const html = rewriteHtml(page.html, {
      baseUrl: page.finalUrl,
      fromPath: urlToLocalPath(page.finalUrl, true).split("/").slice(1).join("/"),
      savedUrls, savedPages,
    });
    await writeFile(join(work, "index.html"), html, "utf8");

    // How many references now point at a file we actually have?
    const refs = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    const local = refs.filter((r) => !/^(https?:|data:|#|mailto:|tel:|javascript:)/i.test(r));
    const resolved = local.filter((r) => existsSync(join(work, r.split("?")[0].split("#")[0])));
    const stillAbsolute = refs.filter((r) => /^https?:/i.test(r));

    console.log(`\n  ${target}`);
    console.log(`  downloaded          ${dl.saved.length} files`);
    console.log(`  references in html  ${refs.length}`);
    console.log(`  rewritten to local  ${local.length}`);
    console.log(`  of those, on disk   ${resolved.length}  <-- these work offline`);
    console.log(`  left absolute       ${stillAbsolute.length}  (not downloaded, left usable online)`);
    console.log(`\n  open it:  ${join(work, "index.html")}\n`);
  } finally {
    await browser.close();
  }
}
main();
