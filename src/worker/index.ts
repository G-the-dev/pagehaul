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
import { UnsafeUrlError } from "../engine/safety.js";
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

    // Only files worth downloading. Tracking pixels and analytics beacons are
    // not part of a site you want to open offline.
    const assets = page.requestedResources.filter((u) =>
      /\.(jpe?g|png|webp|avif|gif|svg|ico|mp4|webm|mp3|wav|woff2?|ttf|otf|css|js|mjs|json|pdf)(\?|$)/i.test(
        u,
      ),
    );

    await update(jobId, {
      pagesFound: 1,
      pagesDone: 1,
      assetsDone: 0,
      stage: "Rendered. Asset download arrives in step 2.",
      warnings: JSON.stringify(warnings),
    });

    console.log(
      `[worker] ${jobId} rendered ${page.finalUrl} in ${(page.ms / 1000).toFixed(1)}s, ${assets.length} assets discovered`,
    );

    // Step 2 replaces this with a real download, zip and upload. Marking the
    // job complete here keeps the pipeline observable end to end in the
    // meantime, rather than leaving jobs stuck in running.
    await update(jobId, {
      status: "complete",
      stage: "Render complete",
      finishedAt: new Date(),
      expiresAt: new Date(Date.now() + LIMITS.downloadTtlHours * 3600_000),
    });
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
