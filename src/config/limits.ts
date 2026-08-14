/**
 * Every tunable number lives here.
 *
 * The point is that you can change what the service allows without reading any
 * other file. If you find yourself adding a cap somewhere else in the codebase,
 * move it here instead.
 *
 * Anything that might differ between your laptop and the server reads from an
 * environment variable with the value below as the fallback.
 */

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const LIMITS = {
  /* ---- what a single job may do ---- */

  /** Links deep from the starting page. 1 means the page and what it links to. */
  maxDepth: num("MAX_DEPTH", 2),

  /** Hard ceiling on pages rendered, whatever the depth allows. */
  maxPages: num("MAX_PAGES", 25),

  /** Whole job byte ceiling. Abort cleanly past this and report what we got. */
  maxJobBytes: num("MAX_JOB_BYTES", 250 * 1024 * 1024),

  /** A single asset larger than this is skipped and logged. */
  maxAssetBytes: num("MAX_ASSET_BYTES", 25 * 1024 * 1024),

  /** Give up on one page after this long. */
  pageTimeoutMs: num("PAGE_TIMEOUT_MS", 30_000),

  /** Give up on one asset fetch after this long. */
  assetTimeoutMs: num("ASSET_TIMEOUT_MS", 20_000),

  /** Give up on the entire job after this long. */
  jobTimeoutMs: num("JOB_TIMEOUT_MS", 10 * 60_000),

  /** Parallel asset fetches. Higher is faster and ruder to the target site. */
  assetConcurrency: num("ASSET_CONCURRENCY", 5),

  /* ---- what one submitter may do ---- */

  /** Jobs per IP per hour. */
  jobsPerIpPerHour: num("JOBS_PER_IP_PER_HOUR", 5),

  /** An IP may only have this many jobs running at once. */
  concurrentJobsPerIp: num("CONCURRENT_JOBS_PER_IP", 1),

  /* ---- what the worker as a whole may do ---- */

  /** Jobs the worker runs at the same time. Each one holds a browser. */
  workerConcurrency: num("WORKER_CONCURRENCY", 2),

  /* ---- storage ---- */

  /**
   * How long a finished archive stays downloadable. Short on purpose: it keeps
   * storage cost near zero and limits how long anyone's content sits on our
   * disk. The bucket lifecycle rule must be set to the same number.
   */
  downloadTtlHours: num("DOWNLOAD_TTL_HOURS", 24),

  /* ---- who we refuse ---- */

  /**
   * Hosts we will not touch, whatever the reason. Matching covers subdomains,
   * so "example.com" also blocks "cdn.example.com".
   * Supply your own list; these are only a starting shape.
   */
  deniedHosts: (process.env.DENIED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
} as const;

/** True when a hostname is on the denylist, including as a subdomain. */
export function isDeniedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return LIMITS.deniedHosts.some(
    (denied) => h === denied || h.endsWith(`.${denied}`),
  );
}
