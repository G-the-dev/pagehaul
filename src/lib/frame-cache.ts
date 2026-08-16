/**
 * Remembering what a tile has already drawn, so scrolling back is instant.
 *
 * The grid only mounts the rows in view, so a tile that scrolls off is
 * destroyed and rebuilt when it scrolls back. The bytes are already in the
 * browser's cache, so nothing re-downloads — but a rebuilt <video> still has to
 * re-parse, seek and decode a frame, and with dozens of videos on screen that
 * churn is the stutter you feel. An image that has decoded once is cheap to
 * show again; a video frame is not, so it is worth capturing.
 *
 * This lives for the life of the page and is never persisted — one small JPEG
 * per video, nothing a scan retained.
 */

/** Video URL → a captured poster frame as a data URL. */
const posterCache = new Map<string, string>();

/** Videos whose frame could not be captured, so the attempt is not repeated. */
const uncapturable = new Set<string>();

export function cachedPoster(url: string): string | undefined {
  return posterCache.get(url);
}

/**
 * Captures one frame of a video, once, if the origin permits reading it back.
 *
 * A cross-origin video taints a canvas, and reading a tainted canvas throws —
 * so the capture runs on a separate element opened with CORS, and any failure
 * (no CORS headers, a decode error, a security error) simply means this video
 * is left to render live every time. The visible tile is never given
 * crossOrigin, because a server without CORS headers would then refuse to load
 * it at all.
 *
 * Runs when the browser is idle so it never competes with a scroll.
 */
export function capturePoster(url: string, atSeconds: number): void {
  if (posterCache.has(url) || uncapturable.has(url)) return;
  uncapturable.add(url); // claim it up front, so two tiles never both try

  const run = () => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      v.removeAttribute("src");
      v.load();
    };

    const grab = () => {
      try {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (!w || !h) return done();
        // Downscale to tile size; a full-resolution frame is wasted here.
        const scale = Math.min(1, 480 / w);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return done();
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.72);
        posterCache.set(url, data);
        uncapturable.delete(url);
      } catch {
        // Tainted canvas: this origin will not let us read it. Leave it in the
        // uncapturable set so the tile keeps rendering the frame live.
      } finally {
        done();
      }
    };

    v.addEventListener("seeked", grab, { once: true });
    v.addEventListener("error", done, { once: true });
    v.addEventListener(
      "loadeddata",
      () => {
        try {
          v.currentTime = atSeconds;
        } catch {
          grab();
        }
      },
      { once: true },
    );
    // A guard, in case neither seeked nor error ever fires.
    setTimeout(done, 8000);
    v.src = `${url}#t=${atSeconds}`;
  };

  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  } else {
    setTimeout(run, 200);
  }
}
