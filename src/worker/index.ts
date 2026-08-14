/**
 * The worker process.
 *
 * This runs on its own, separately from the website. It watches the queue, and
 * when a job appears it opens a browser, renders the page, and writes progress
 * back to the database as it goes.
 *
 * Keeping it separate matters: rendering holds a browser open for minutes,
 * which a web request cannot do. It also means you can restart the website
 * without killing work in flight, and run more workers later without touching
 * the site.
 *
 * Start it with:  npm run worker
 */

import { Worker, type Job as BullJob } from "bullmq";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../lib/db.js";
import { LIMITS } from "../config/limits.js";
import { launchBrowser, renderPage } from "../engine/render.js";
import { downloadAssets } from "../engine/download.js";
import { UnsafeUrlError } from "../engine/safety.js";
import {
  createR2Client,
  objectKeyForJob,
  presignDownload,
  readR2Config,
  zipDirectoryToR2,
} from "../storage/r2.js";
import {
  SITE_JOB_QUEUE,
  redisConnection,
  type SiteJobPayload,
} from "../queue/queue.js";

/** Writes the current state of a job so the web layer can show it. */
async function update(
  jobId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await db.job.update({ where: { id: jobId }, data });
  } catch {
    // A job cancelled and deleted mid run should not crash the worker.
  }
}

/**
 * Runs one job end to end.
 *
 * Step 1 scope: render the starting page and record what it found. Downloading
 * the assets, rewriting links and zipping to storage arrive in the next steps,
 * which is why the temp directory is created and then cleaned up empty.
 */
async function runJob(bullJob: BullJob<SiteJobPayload>): Promise<void> {
  const { jobId } = bullJob.data;

  const record = await db.job.findUnique({ where: { id: jobId } });
  if (!record) {
    console.warn(`[worker] job ${jobId} has no database row, skipping`);
    return;
  }
  if (record.status === "cancelled") {
    console.log(`[worker] job ${jobId} was cancelled before it started`);
    return;
  }

  const warnings: string[] = [];
  const workDir = await mkdtemp(join(tmpdir(), `pagehaul-${jobId}-`));
  const startedAt = new Date();

  await update(jobId, {
    status: "running",
    startedAt,
    stage: "Starting",
  });

  // A job that hangs must not hold a worker slot forever.
  const deadline = setTimeout(() => {
    void update(jobId, {
      status: "failed",
      error: `Job exceeded its time limit of ${LIMITS.jobTimeoutMs / 1000}s.`,
      finishedAt: new Date(),
    });
  }, LIMITS.jobTimeoutMs);

  const browser = await launchBrowser();

  try {
    await update(jobId, { stage: "Opening the page in a browser" });

    const page = await renderPage(record.url, browser, {
      timeoutMs: LIMITS.pageTimeoutMs,
      onProgress: (p) => {
        if (p.current) void update(jobId, { stage: p.current });
      },
    });

    // --- download the assets the page asked for -----------------------
    await update(jobId, { stage: "Downloading files" });

    const dl = await downloadAssets(
      page.requestedResources,
      workDir,
      {
        maxJobBytes: LIMITS.maxJobBytes,
        maxAssetBytes: LIMITS.maxAssetBytes,
        timeoutMs: LIMITS.assetTimeoutMs,
        concurrency: LIMITS.assetConcurrency,
      },
      (p) => {
        void update(jobId, {
          assetsDone: p.done,
          bytes: p.bytes,
          stage: `Downloading files, ${p.done} of ${p.total}`,
        });
      },
    );
    warnings.push(...dl.warnings);

    // Save the rendered HTML alongside the assets. Link rewriting is the next
    // engine step, so for now this is the DOM exactly as the browser had it.
    const { writeFile: write } = await import("node:fs/promises");
    await write(join(workDir, "index.html"), page.html, "utf8");

    await update(jobId, {
      pagesFound: 1,
      pagesDone: 1,
      assetsDone: dl.saved.length,
      bytes: dl.totalBytes,
      warnings: JSON.stringify(warnings.slice(0, 200)),
    });

    console.log(
      `[worker] ${jobId} saved ${dl.saved.length} files, ${(dl.totalBytes / 1024 / 1024).toFixed(1)}MB`,
    );

    // --- zip straight to storage ---------------------------------------
    const r2 = readR2Config();
    if (!r2) {
      // Without credentials the capture still succeeded; there is just nowhere
      // to put it. Say that plainly rather than reporting a failure.
      await update(jobId, {
        status: "complete",
        stage: `Captured ${dl.saved.length} files. Storage is not configured, so no download link was created.`,
        finishedAt: new Date(),
        warnings: JSON.stringify(warnings.slice(0, 200)),
      });
      return;
    }

    await update(jobId, { stage: "Packaging and uploading" });

    const client = createR2Client(r2);
    const host = new URL(page.finalUrl).hostname.replace(/^www\./, "");
    const key = objectKeyForJob(jobId, host);

    const zipped = await zipDirectoryToR2(client, r2.bucket, key, workDir, (b) => {
      void update(jobId, {
        stage: `Packaging, ${(b / 1024 / 1024).toFixed(1)}MB written`,
      });
    });

    const ttlSeconds = LIMITS.downloadTtlHours * 3600;
    const url = await presignDownload(
      client,
      r2.bucket,
      key,
      ttlSeconds,
      `${host}-assets.zip`,
    );

    await update(jobId, {
      status: "complete",
      stage: "Ready to download",
      zipKey: key,
      zipBytes: zipped.bytes,
      downloadUrl: url,
      finishedAt: new Date(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      warnings: JSON.stringify(warnings.slice(0, 200)),
    });

    console.log(
      `[worker] ${jobId} uploaded ${(zipped.bytes / 1024 / 1024).toFixed(1)}MB to ${key}`,
    );

  } catch (err) {
    const message =
      err instanceof UnsafeUrlError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);

    console.error(`[worker] ${jobId} failed: ${message}`);
    await update(jobId, {
      status: "failed",
      error: message,
      finishedAt: new Date(),
      warnings: JSON.stringify(warnings),
    });
  } finally {
    clearTimeout(deadline);
    await browser.close().catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const worker = new Worker<SiteJobPayload>(SITE_JOB_QUEUE, runJob, {
  connection: redisConnection,
  concurrency: LIMITS.workerConcurrency,
});

worker.on("ready", () => {
  console.log(
    `[worker] listening on "${SITE_JOB_QUEUE}", ${LIMITS.workerConcurrency} at a time`,
  );
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} threw: ${err.message}`);
});

// Finish the job in hand before exiting, so a deploy does not lose work.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    console.log(`[worker] ${signal} received, finishing current jobs`);
    await worker.close();
    await db.$disconnect();
    process.exit(0);
  });
}
