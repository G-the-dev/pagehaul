import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { request } from "undici";
import { assertSafeToFetch, parseTargetUrl } from "./safety.js";
import { urlToLocalPath } from "./paths.js";
import { USER_AGENT } from "./types.js";

/**
 * Downloads the files a page asked for.
 *
 * Rendering is slow because it runs a browser. Fetching the assets afterwards
 * is plain HTTP, so it can run several at a time and finishes quickly. That is
 * the reason for two separate paths rather than letting the browser save
 * everything: speed, and control over what we accept.
 *
 * Nothing here modifies a file. Whatever the server sends is what lands on
 * disk, byte for byte.
 */

export interface DownloadLimits {
  maxJobBytes: number;
  maxAssetBytes: number;
  timeoutMs: number;
  concurrency: number;
}

export interface DownloadedAsset {
  url: string;
  localPath: string;
  bytes: number;
  contentType?: string;
}

export interface DownloadResult {
  saved: DownloadedAsset[];
  warnings: string[];
  totalBytes: number;
  /** True when we stopped early because the job byte ceiling was reached. */
  hitCeiling: boolean;
}

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  current?: string;
}

/** Files worth keeping. A tracking pixel is not part of a site you open offline. */
const WANTED =
  /\.(jpe?g|png|webp|avif|gif|svg|ico|bmp|mp4|webm|ogv|mp3|wav|ogg|m4a|woff2?|ttf|otf|eot|css|js|mjs|json|pdf|txt|xml)(\?|$)/i;

const SKIP_HOSTS =
  /(^|\.)(google-analytics\.com|googletagmanager\.com|doubleclick\.net|facebook\.net|hotjar\.com|segment\.(io|com)|sentry\.io|intercom\.io)$/i;

export function shouldDownload(rawUrl: string): boolean {
  if (!/^https?:\/\//i.test(rawUrl)) return false;
  try {
    const u = new URL(rawUrl);
    if (SKIP_HOSTS.test(u.hostname)) return false;
    return WANTED.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

/**
 * Fetches one file and writes it. Returns null on any failure, having recorded
 * a warning: a missing asset must never end the job.
 */
async function fetchOne(
  rawUrl: string,
  outDir: string,
  limits: DownloadLimits,
  warnings: string[],
): Promise<DownloadedAsset | null> {
  let url: URL;
  try {
    url = parseTargetUrl(rawUrl);
    // An asset can live on a different host from the page, and that host must
    // pass the same checks. A redirect to a private address is the risk here.
    await assertSafeToFetch(url);
  } catch (e) {
    warnings.push(`Skipped ${rawUrl}: ${e instanceof Error ? e.message : e}`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);

  try {
    const res = await request(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
    });

    if (res.statusCode >= 400) {
      warnings.push(`${res.statusCode} on ${rawUrl}`);
      return null;
    }

    // Refuse an oversized file before reading it, when the server says how big.
    const declared = Number(res.headers["content-length"] ?? 0);
    if (declared && declared > limits.maxAssetBytes) {
      warnings.push(
        `Skipped ${rawUrl}: ${(declared / 1024 / 1024).toFixed(1)}MB exceeds the per file limit`,
      );
      return null;
    }

    // Servers often omit content-length, so also stop mid stream if it runs long.
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of res.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > limits.maxAssetBytes) {
        warnings.push(`Skipped ${rawUrl}: exceeded the per file limit while downloading`);
        controller.abort();
        return null;
      }
      chunks.push(buf);
    }

    const localPath = urlToLocalPath(url.toString());
    const full = join(outDir, localPath);

    // Belt and braces: even after sanitising, refuse anything that resolved
    // outside the output directory.
    if (!resolve(full).startsWith(resolve(outDir))) {
      warnings.push(`Skipped ${rawUrl}: path escaped the output directory`);
      return null;
    }

    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, Buffer.concat(chunks));

    return {
      url: url.toString(),
      localPath,
      bytes: size,
      contentType: String(res.headers["content-type"] ?? "").split(";")[0] || undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`Failed ${rawUrl}: ${msg.slice(0, 90)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Downloads a list of URLs, a few at a time.
 *
 * The concurrency limit is a courtesy as much as a performance choice: firing
 * two hundred requests at once looks like an attack and gets you blocked.
 */
export async function downloadAssets(
  urls: string[],
  outDir: string,
  limits: DownloadLimits,
  onProgress?: (p: DownloadProgress) => void,
): Promise<DownloadResult> {
  const unique = [...new Set(urls.filter(shouldDownload))];
  const saved: DownloadedAsset[] = [];
  const warnings: string[] = [];
  let totalBytes = 0;
  let hitCeiling = false;
  let index = 0;
  let done = 0;

  async function worker(): Promise<void> {
    while (index < unique.length && !hitCeiling) {
      const url = unique[index++];
      onProgress?.({ done, total: unique.length, bytes: totalBytes, current: url });

      const asset = await fetchOne(url, outDir, limits, warnings);
      done++;

      if (asset) {
        saved.push(asset);
        totalBytes += asset.bytes;

        // Stop cleanly at the ceiling and report what we did get, rather than
        // failing the whole job.
        if (totalBytes >= limits.maxJobBytes) {
          hitCeiling = true;
          warnings.push(
            `Stopped at the ${(limits.maxJobBytes / 1024 / 1024).toFixed(0)}MB job limit. ${saved.length} of ${unique.length} files were saved.`,
          );
        }
      }

      onProgress?.({ done, total: unique.length, bytes: totalBytes });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limits.concurrency, unique.length) }, worker),
  );

  return { saved, warnings, totalBytes, hitCeiling };
}
