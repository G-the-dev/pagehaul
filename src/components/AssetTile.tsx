"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@/lib/types";
import { Check } from "lucide-react";
import { thumbnailUrl } from "@/lib/variants";
import { cachedPoster, capturePoster } from "@/lib/frame-cache";
import { cachedShotThumb, makeShotThumb } from "@/lib/shot-thumbs";
import { cachedModelPoster, ensureModelPoster } from "@/lib/model-thumbs";
import { ModelLoading, modelRenderable } from "./ModelPreview";
import { formatBytes } from "@/lib/download";
import { Tooltip } from "./ui/Tooltip";

interface Props {
  asset: Asset;
  selected: boolean;
  onToggle: (id: string) => void;
  onMeasure: (id: string, w: number, h: number) => void;
  /** The tile's image loaded and turned out to be one flat colour. */
  onBlank?: (id: string) => void;
  /** Picker mode: click means select, so the preview affordance is hidden. */
  compact?: boolean;
  /** Results mode shows no checkbox — a click downloads instead. */
  selectable?: boolean;
}

function cornerLabel(a: Asset): string | null {
  if (a.width && a.height) return `${a.width}×${a.height}`;
  if (a.kind === "video") return "video";
  return null;
}

/**
 * True when a loaded image is one flat colour — a blank.
 *
 * Placeholder JPEGs and empty vector wrappers load successfully and render
 * as nothing: a white rectangle wearing a real filename. Sampling a few
 * pixels tells them apart from pictures. An image that mixes transparent
 * and opaque pixels has a shape and is spared — a white logo on a
 * transparent ground is a real logo, not a blank. A canvas the browser
 * refuses to read back (cross-origin without CORS) proves nothing, so the
 * file is kept.
 */
function looksBlank(el: HTMLImageElement): boolean {
  try {
    const S = 12;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(el, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    let opaque = 0;
    let transparent = 0;
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) {
        transparent++;
        continue;
      }
      opaque++;
      rMin = Math.min(rMin, d[i]); rMax = Math.max(rMax, d[i]);
      gMin = Math.min(gMin, d[i + 1]); gMax = Math.max(gMax, d[i + 1]);
      bMin = Math.min(bMin, d[i + 2]); bMax = Math.max(bMax, d[i + 2]);
    }
    if (opaque === 0) return true; // nothing visible at all
    if (transparent > 0) return false; // has a silhouette — a real shape
    return rMax - rMin + (gMax - gMin) + (bMax - bMin) < 24; // one flat colour
  } catch {
    return false;
  }
}

/**
 * Memoised because the virtualiser re-renders the row list on every scroll
 * step, and a tile whose asset has not changed has nothing to redo. The
 * callbacks it receives are stable, so the comparison actually holds.
 */
export const AssetTile = memo(function AssetTile({
  asset,
  selected,
  onToggle,
  onMeasure,
  onBlank,
  compact,
  selectable = true,
}: Props) {
  const [failed, setFailed] = useState(false);
  /**
   * Whether this tile is actually on screen.
   *
   * The grid keeps a band of tiles mounted beyond the fold, and a <video> that
   * is mounted but off screen would still decode a frame — dozens of them at
   * once is the storm that leaves every video stuck on a play button. A video
   * only decodes while it is visible; everything else waits as a still tile.
   */
  const tileRef = useRef<HTMLDivElement>(null);
  // `settled` is the gate for decoding a video frame: the tile has been in
  // view long enough that the scroll has stopped on it. Decoding while a scroll
  // is flying past is the lag — a 3MB frame is expensive, and a screenful of
  // them mid-scroll locks the page. So during a scroll every video shows the
  // still placeholder, and only when you come to rest does what is on screen
  // decode.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = tileRef.current;
    if (!el || asset.kind !== "video") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      // A little ahead of the viewport so a frame starts decoding just before
      // the tile is seen, not after.
      rootMargin: "300px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [asset.kind]);
  /**
   * True once a downscaled request has been refused, so we go back to the file
   * the page actually referenced. A guessed thumbnail must never be the reason
   * a tile is empty.
   */
  const [thumbRefused, setThumbRefused] = useState(false);

  // Smallest known variant first, then a downscaled request if the address
  // offers one, and only then the full-size file.
  const base = asset.thumbUrl ?? asset.poster ?? asset.url;
  const derived = useMemo(
    () => (asset.kind === "image" ? thumbnailUrl(base) : null),
    [asset.kind, base],
  );
  const previewSrc = derived && !thumbRefused ? derived : base;
  // A capture is megabytes of JPEG, and the virtualiser rebuilds this tile on
  // every scroll-back. The tile shows a once-made small copy instead, so the
  // full thing is decoded exactly once per scan.
  const [shotThumb, setShotThumb] = useState<string | undefined>(() =>
    asset.kind === "screenshot" ? cachedShotThumb(asset.id) : undefined,
  );
  useEffect(() => {
    if (asset.kind !== "screenshot" || shotThumb) return;
    let alive = true;
    makeShotThumb(asset.id, asset.url).then((t) => {
      if (alive && t) setShotThumb(t);
    });
    return () => {
      alive = false;
    };
  }, [asset.kind, asset.id, asset.url, shotThumb]);
  // Route raster thumbnails through the image optimizer, which fetches each one
  // once, resizes it, and serves it cached. Direct cross-origin requests to
  // hundreds of origins at once is what left tiles blank and reloaded them on
  // every scroll. SVG is served direct (the optimizer refuses it and it is
  // already tiny), and if the optimizer cannot fetch a host we fall back to the
  // origin.
  const [optFailed, setOptFailed] = useState(false);
  const usingOptimizer = asset.kind === "image" && !optFailed;
  const imgSrc =
    asset.kind === "screenshot"
      ? (shotThumb ?? asset.url)
      : usingOptimizer
        ? `/_next/image?url=${encodeURIComponent(previewSrc)}&w=420&q=70`
        : previewSrc;
  // A frame we captured client-side on a previous mount (CORS videos), if any.
  const poster = asset.kind === "video" ? cachedPoster(asset.url) : undefined;
  // The server-captured poster for a video: a plain image that preloads and
  // caches like every other thumbnail, so the grid never decodes video itself.
  const [posterFailed, setPosterFailed] = useState(false);
  const serverPoster =
    asset.kind === "video" && !poster && !posterFailed
      ? `/api/poster?url=${encodeURIComponent(asset.url)}`
      : undefined;
  // A model tile never runs live 3D. It asks the render queue for a poster —
  // one hidden render at a time, browser-wide, because a grid of viewers
  // exhausts the WebGL context limit and the browser starts shooting the
  // oldest — and shows the loading cube until its turn produces the frame.
  const [modelPoster, setModelPoster] = useState<string | undefined>(() =>
    asset.kind === "model" ? cachedModelPoster(asset.id) : undefined,
  );
  const [modelFailed, setModelFailed] = useState(false);
  useEffect(() => {
    if (asset.kind !== "model" || modelPoster || !modelRenderable(asset.url)) {
      return;
    }
    let alive = true;
    ensureModelPoster(asset.id, asset.url).then((p) => {
      if (!alive) return;
      if (p) setModelPoster(p);
      else setModelFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [asset.kind, asset.id, asset.url, modelPoster]);

  const corner = cornerLabel(asset);
  const showsImage =
    !failed &&
    (asset.kind === "image" ||
      asset.kind === "svg" ||
      asset.kind === "screenshot" ||
      !!asset.poster);
  /** A video with no poster still has frames; use one rather than a blank box. */
  const showsVideoFrame = !failed && asset.kind === "video" && !asset.poster;

  return (
    <div
      ref={tileRef}
      className={`group relative overflow-hidden rounded-xl border bg-surface transition-all duration-200 ${
        // Selection used to draw a full-strength accent border plus a matching
        // ring, which on a grid of many selected tiles is a wall of white with
        // the pictures fighting through it. A soft ring reads as clearly
        // without shouting; the tick in the corner is the unambiguous signal.
        selected
          ? "border-accent/45 shadow-[0_0_0_1px_rgb(var(--raise)/0.22)]"
          : "border-border hover:border-border-strong hover:shadow-soft"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(asset.id)}
        aria-pressed={selectable ? selected : undefined}
        aria-label={
          selectable
            ? `${selected ? "Deselect" : "Select"} ${asset.displayName}`
            : `Preview ${asset.displayName}`
        }
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          data-tile-media
          className={`relative aspect-[4/3] w-full overflow-hidden ${
            asset.transparent && showsImage ? "bg-checker" : "bg-surface-2"
          }`}
        >
          {showsImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imgSrc}
              alt=""
              // Eager, not lazy. The grid only mounts a small band of tiles
              // (virtualization caps it), and the optimizer's first pass on an
              // image costs about a second — so a lazy tile is requested only
              // once it is already on screen and sits blank while it optimizes.
              // Eager starts that work as soon as the tile mounts in the
              // overscan band, a few rows ahead, so by the time it scrolls into
              // view the optimized image is cached and paints at once.
              loading="eager"
              decoding="async"
              onError={() => {
                // Peel back one layer at a time: optimizer to origin, then a
                // downscaled request the CDN would not honour to the address the
                // page itself used, then give up to the placeholder.
                if (usingOptimizer) setOptFailed(true);
                else if (derived && !thumbRefused) setThumbRefused(true);
                else setFailed(true);
              }}
              onLoad={(e) => {
                const el = e.currentTarget;
                // Only believe the measurement when what loaded is the file
                // itself. The preview is deliberately the smallest variant of
                // the family, so its dimensions describe the thumbnail — that
                // is how a 1200px original ends up labelled 236x314.
                if (el.naturalWidth && previewSrc === asset.url) {
                  onMeasure(asset.id, el.naturalWidth, el.naturalHeight);
                }
                // Loaded is not the same as showing something. A placeholder
                // JPEG or an empty vector renders as a flat rectangle wearing
                // a real filename; the pixels are the only honest witness.
                if (
                  onBlank &&
                  (asset.kind === "image" ||
                    asset.kind === "svg" ||
                    // Our own captures are not above suspicion: a section
                    // that draws itself with WebGL or reveals on scroll can
                    // photograph as a white rectangle, and a blank we made
                    // is still a blank.
                    asset.kind === "screenshot") &&
                  looksBlank(el)
                ) {
                  onBlank(asset.id);
                }
              }}
              className={
                asset.transparent
                  ? "absolute inset-0 m-auto max-h-[78%] max-w-[78%] object-contain"
                  : // A screenshot crops from the top — its top edge is where
                    // the section starts, and centre-cropping a full-page
                    // capture shows an arbitrary mid-scroll slice instead.
                    `h-full w-full object-cover ${
                      asset.kind === "screenshot" ? "object-top" : ""
                    } transition-transform duration-500 group-hover:scale-[1.03]`
              }
            />
          ) : poster ? (
            /* A frame captured on an earlier mount. Instant, no video to
               re-instantiate — this is what makes scrolling back smooth. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={poster}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : serverPoster ? (
            /* The frame captured server-side, served as a cached image — no
               client decode, so a grid of hundreds of videos stays smooth. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={serverPoster}
              alt=""
              loading="eager"
              decoding="async"
              onError={() => setPosterFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : showsVideoFrame && visible ? (
            /*
              Fallback when the server could not capture a frame: decode it
              live while the tile is on screen. A media fragment plus a seek
              paints one; once up we try to keep a copy (see capturePoster).
            */
            <video
              src={`${asset.url}#t=1`}
              preload="metadata"
              muted
              playsInline
              onError={() => setFailed(true)}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.videoWidth) onMeasure(asset.id, el.videoWidth, el.videoHeight);
                if (el.readyState < 2) {
                  const at = Number.isFinite(el.duration)
                    ? Math.min(1, el.duration / 4)
                    : 0.1;
                  try {
                    el.currentTime = at;
                  } catch {
                    /* seeking needs range requests; the play badge still shows */
                  }
                }
              }}
              onSeeked={(e) => {
                // The frame is up. Capture it for next time, off the main
                // thread's critical path.
                const at = e.currentTarget.currentTime || 1;
                capturePoster(asset.url, at);
              }}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : asset.kind === "model" && modelPoster ? (
            /* The frame captured on an earlier mount — a model as cheap to
               scroll past as a photograph. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={modelPoster}
              alt=""
              className="h-full w-full object-contain p-2"
            />
          ) : asset.kind === "model" &&
            modelRenderable(asset.url) &&
            !modelFailed ? (
            /* In the queue. The pulse says a preview is on its way; the
               poster replaces it the moment this model's turn completes. */
            <ModelLoading label="rendering preview" />
          ) : (
            <TypePlaceholder asset={asset} failed={failed} />
          )}

          {asset.kind === "video" && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55">
              <span className="ml-[3px] border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
            </span>
          )}

          {selectable && (
            <span
              aria-hidden
              className={`absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full border transition-colors ${
                selected
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-white/45 bg-black/40 group-hover:border-white/80"
              }`}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          )}

          {asset.section && (
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/90">
              {asset.section}
            </span>
          )}

          {corner && (
            <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90">
              {corner}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
        <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-wide text-fg-2">
          {asset.format}
        </span>
        {/* The name only. A CDN address runs to hundreds of characters and
            turns a hint into a wall of text over the thing you are trying to
            look at; the preview shows it properly, and Copy URL hands it over. */}
        <Tooltip label={asset.displayName} className="min-w-0 flex-1">
          <span className="block w-full truncate text-[12px] text-fg-2">
            {asset.displayName}
          </span>
        </Tooltip>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatBytes(asset.bytes)}
        </span>
      </div>
    </div>
  );
});

/** Types with no natural picture get something more useful than a file icon. */
function TypePlaceholder({ asset, failed }: { asset: Asset; failed: boolean }) {
  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-border-strong font-mono text-[12px] text-muted-foreground">
          !
        </span>
        <span className="font-mono text-[9.5px] leading-tight text-muted-foreground">
          Preview blocked
          <br />
          by the source
        </span>
      </div>
    );
  }

  switch (asset.kind) {
    case "font":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          <span className="text-[2.6rem] font-medium leading-none tracking-tight text-fg-2">
            Ag
          </span>
          <span className="label-mono text-[9px]">{asset.format}</span>
        </div>
      );
    case "audio":
      return (
        <div className="flex h-full items-center justify-center gap-[3px] px-8">
          {[22, 48, 80, 56, 100, 38, 70, 26, 60, 44, 86, 30].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h * 0.4}%` }}
              className="w-full max-w-[3px] flex-1 rounded-full bg-accent/60"
            />
          ))}
        </div>
      );
    case "model":
      // The formats no browser engine draws still deserve better than a
      // bare format code: a cube says "3D" at a glance.
      return (
        <div className="grid h-full place-items-center">
          <div className="flex flex-col items-center gap-2">
            <svg
              viewBox="0 0 48 48"
              className="h-12 w-12 text-fg-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            >
              <path d="M24 6 40 15v18L24 42 8 33V15L24 6Z" />
              <path d="M8 15l16 9 16-9M24 24v18" />
            </svg>
            <span className="label-mono text-[9px]">{asset.format}</span>
          </div>
        </div>
      );
    case "document":
      return (
        <div className="grid h-full place-items-center">
          <div className="flex h-[68%] w-[50%] flex-col gap-[3px] rounded-md border border-border-strong bg-surface p-2.5">
            {[78, 100, 60, 100, 78, 55].map((w, i) => (
              <span
                key={i}
                style={{ width: `${w}%` }}
                className="h-[2.5px] rounded-full bg-surface-3"
              />
            ))}
          </div>
        </div>
      );
    case "code":
      return (
        <div className="grid h-full place-items-center">
          <div className="flex w-[62%] flex-col gap-1.5">
            {[80, 55, 70, 42].map((w, i) => (
              <span
                key={i}
                style={{ width: `${w}%` }}
                className={`h-[3px] rounded-full ${i === 1 ? "bg-accent/45" : "bg-surface-3"}`}
              />
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="grid h-full place-items-center">
          <span className="label-mono text-[10px]">{asset.format}</span>
        </div>
      );
  }
}
