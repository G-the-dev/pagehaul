/**
 * Downscaled copies of the scan's screenshots, made once and remembered.
 *
 * A capture is a full-width JPEG — the full-page one can run to twelve
 * thousand pixels tall — and the grid was decoding those megabytes again
 * every time a tile scrolled back into view, which is exactly the churn the
 * virtualiser exists to avoid. One tile-sized copy per capture, made off the
 * main thread the first time its tile appears, costs one decode and then
 * nothing.
 *
 * Lives for the life of the page and is never persisted — the same deal as
 * the video frame cache.
 */

const thumbs = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const THUMB_WIDTH = 480;

export function cachedShotThumb(id: string): string | undefined {
  return thumbs.get(id);
}

export function makeShotThumb(id: string, dataUrl: string): Promise<string | null> {
  const have = thumbs.get(id);
  if (have) return Promise.resolve(have);
  const running = inflight.get(id);
  if (running) return running;

  const job = (async () => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const full = await createImageBitmap(blob);
      const scale = Math.min(1, THUMB_WIDTH / full.width);
      const width = Math.max(1, Math.round(full.width * scale));
      // A tile crops from the top, so the thumb keeps only what a tile can
      // show — a full-page capture would otherwise still be thousands of
      // pixels tall at tile width.
      const height = Math.max(
        1,
        Math.min(Math.round(full.height * scale), Math.round(width * 1.5)),
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(
        full,
        0,
        0,
        full.width,
        Math.round(height / scale),
        0,
        0,
        width,
        height,
      );
      full.close();
      const out = canvas.toDataURL("image/jpeg", 0.75);
      thumbs.set(id, out);
      return out;
    } catch {
      return null; // the tile keeps rendering the full capture
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, job);
  return job;
}
