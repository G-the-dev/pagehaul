import { Queue, type ConnectionOptions } from "bullmq";

/**
 * The queue is the handoff between the web app and the worker.
 *
 * Why a queue at all: rendering a site takes minutes and holds a browser open.
 * If the web request did that work itself, the person would sit on a spinning
 * tab and any restart would lose the job. Instead the web app writes a row,
 * drops an id on the queue, and returns immediately. A separate process picks
 * it up and does the slow part.
 *
 * Only the job id travels on the queue. Everything else is read from the
 * database, so there is one source of truth rather than two copies that drift.
 */

export const SITE_JOB_QUEUE = "site-jobs";

export interface SiteJobPayload {
  jobId: string;
}

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  // BullMQ requires this. Without it a blocking command can throw during a
  // brief Redis hiccup instead of simply waiting and retrying.
  maxRetriesPerRequest: null,
};

let queue: Queue<SiteJobPayload> | null = null;

/** Created on first use so importing this file never opens a connection. */
export function getQueue(): Queue<SiteJobPayload> {
  if (!queue) {
    queue = new Queue<SiteJobPayload>(SITE_JOB_QUEUE, {
      connection: redisConnection,
      defaultJobOptions: {
        // One retry. A site that fails twice is usually genuinely unreachable,
        // and retrying harder is just rude to them and slow for us.
        attempts: 2,
        backoff: { type: "exponential", delay: 5_000 },
        // Keep a short tail for debugging, then let Redis reclaim the memory.
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return queue;
}

export async function enqueueSiteJob(jobId: string): Promise<void> {
  await getQueue().add("capture", { jobId }, { jobId });
}
