import { zip } from "fflate";
import type { Asset } from "./types";

/**
 * Downloads happen in the browser, straight from the origin server.
 * Our backend never carries asset bytes — see the architecture notes in the README.
 *
 * Path A  fetch + blob, which gives a proper filename. Needs the origin to allow
 *         cross-origin reads.
 * Path C  open in a new tab so the user can save manually. Degraded, never a dead end.
 */

export type FetchOutcome =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; reason: "blocked" | "network" | "notfound" };

function safeSegment(s: string): string {
  return (
    s
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^\.+/, "")
      .trim()
      .slice(0, 120) || "file"
  );
}

export function filenameFor(a: Asset): string {
  const ext = a.format.toLowerCase();
  const base = safeSegment(a.name);
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

/** Decodes a data: URL without a network round-trip. */
function decodeDataUrl(url: string): Uint8Array {
  const comma = url.indexOf(",");
  const meta = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  if (meta.includes(";base64")) {
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

export async function fetchAsset(a: Asset, signal?: AbortSignal): Promise<FetchOutcome> {
  const filename = filenameFor(a);

  if (a.url.startsWith("data:")) {
    try {
      return { ok: true, bytes: decodeDataUrl(a.url), filename };
    } catch {
      return { ok: false, reason: "network" };
    }
  }

  try {
    const res = await fetch(a.url, { mode: "cors", credentials: "omit", signal });
    if (!res.ok) {
      return { ok: false, reason: res.status === 404 ? "notfound" : "network" };
    }
    const buf = await res.arrayBuffer();
    return { ok: true, bytes: new Uint8Array(buf), filename };
  } catch {
    // A CORS refusal surfaces as a generic TypeError, indistinguishable from
    // an offline error. Treat it as blocked so the UI offers the open-in-tab path.
    return { ok: false, reason: "blocked" };
  }
}

function triggerBlobDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Path C — the source refused a direct read, so hand the user the raw URL. */
export function openInNewTab(a: Asset) {
  window.open(a.url, "_blank", "noopener,noreferrer");
}

export async function downloadOne(a: Asset): Promise<FetchOutcome> {
  const out = await fetchAsset(a);
  if (out.ok) triggerBlobDownload(out.bytes, out.filename);
  return out;
}

export interface ZipProgress {
  done: number;
  total: number;
  failed: number;
  current?: string;
}

/**
 * Builds the archive in the browser. The user's own connection does the
 * fetching, so a large selection costs us nothing.
 */
export async function downloadAsZip(
  assets: Asset[],
  archiveName: string,
  onProgress?: (p: ZipProgress) => void,
  concurrency = 6,
): Promise<{ added: number; failed: Asset[] }> {
  const files: Record<string, Uint8Array> = {};
  const failed: Asset[] = [];
  const used = new Set<string>();
  let done = 0;
  let i = 0;

  // Group into folders by kind so the archive is navigable.
  function pathFor(a: Asset): string {
    const folder = a.kind === "svg" ? "svg" : `${a.kind}s`;
    let name = filenameFor(a);
    let path = `${folder}/${name}`;
    let n = 2;
    while (used.has(path)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      path = `${folder}/${stem}-${n}${ext}`;
      n++;
    }
    used.add(path);
    return path;
  }

  async function worker() {
    while (i < assets.length) {
      const a = assets[i++];
      onProgress?.({ done, total: assets.length, failed: failed.length, current: a.name });
      const out = await fetchAsset(a);
      if (out.ok) files[pathFor(a)] = out.bytes;
      else failed.push(a);
      done++;
      onProgress?.({ done, total: assets.length, failed: failed.length });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, assets.length) }, worker),
  );

  if (Object.keys(files).length === 0) {
    return { added: 0, failed };
  }

  // A manifest so the archive is still readable months later.
  const manifest = [
    "path,source_url,kind,format,bytes,from_page",
    ...assets
      .filter((a) => !failed.includes(a))
      .map((a) =>
        [
          filenameFor(a),
          a.url,
          a.kind,
          a.format,
          a.bytes ?? "",
          a.fromPage,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
  ].join("\n");
  files["manifest.csv"] = new TextEncoder().encode(manifest);

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });

  triggerBlobDownload(bytes, `${safeSegment(archiveName)}.zip`);
  return { added: Object.keys(files).length - 1, failed };
}

/** Sequential single-file downloads, spaced so browsers do not block the batch. */
export async function downloadEachSeparately(
  assets: Asset[],
  onProgress?: (p: ZipProgress) => void,
): Promise<{ added: number; failed: Asset[] }> {
  const failed: Asset[] = [];
  let added = 0;
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    onProgress?.({ done: i, total: assets.length, failed: failed.length, current: a.name });
    const out = await fetchAsset(a);
    if (out.ok) {
      triggerBlobDownload(out.bytes, out.filename);
      added++;
      await new Promise((r) => setTimeout(r, 220));
    } else {
      failed.push(a);
    }
  }
  onProgress?.({ done: assets.length, total: assets.length, failed: failed.length });
  return { added, failed };
}

export function formatBytes(n?: number): string {
  if (n === undefined || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
