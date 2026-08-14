/**
 * Runs render + download + local zip without needing Redis or R2, so the
 * pipeline is provable before any credentials exist.
 */
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import { launchBrowser, renderPage } from "../src/engine/render.js";
import { downloadAssets } from "../src/engine/download.js";
import { LIMITS } from "../src/config/limits.js";

async function main() {
  const target = process.argv[2] ?? "https://example.com";
  const work = await mkdtemp(join(tmpdir(), "ph-test-"));
  const browser = await launchBrowser();
  const t0 = Date.now();

  try {
    console.log(`\n  target ${target}`);
    const page = await renderPage(target, browser, { timeoutMs: LIMITS.pageTimeoutMs });
    console.log(`  rendered   ${page.requestedResources.length} requests, ${(page.ms / 1000).toFixed(1)}s`);

    const dl = await downloadAssets(page.requestedResources, work, {
      maxJobBytes: LIMITS.maxJobBytes,
      maxAssetBytes: LIMITS.maxAssetBytes,
      timeoutMs: LIMITS.assetTimeoutMs,
      concurrency: LIMITS.assetConcurrency,
    });
    console.log(`  downloaded ${dl.saved.length} files, ${(dl.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    if (dl.warnings.length) console.log(`  warnings   ${dl.warnings.length} (job continued)`);

    // Same streaming shape as the R2 path, writing to a file instead.
    const zipPath = join(work, "..", `ph-test-${Date.now()}.zip`);
    const out = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(out);
    archive.directory(work, false);
    await archive.finalize();
    await new Promise<void>((r) => out.on("close", () => r()));

    const zs = await stat(zipPath);
    console.log(`  zipped     ${(zs.size / 1024 / 1024).toFixed(2)} MB -> ${zipPath}`);
    console.log(`  total      ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

    console.log("  sample of what landed on disk:");
    for (const a of dl.saved.slice(0, 6)) {
      console.log(`    ${String(Math.round(a.bytes / 1024)).padStart(6)} KB  ${a.localPath}`);
    }
    console.log();
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}
main();
