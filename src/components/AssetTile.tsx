"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@/lib/types";
import { thumbnailUrl } from "@/lib/variants";
import { cachedPoster, capturePoster } from "@/lib/frame-cache";
import { formatBytes } from "@/lib/download";
import { Tooltip } from "./ui/Tooltip";

interface Props {
  asset: Asset;
  selected: boolean;
  onToggle: (id: string) => void;
  onMeasure: (id: string, w: number, h: number) => void;
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
 * Memoised because the virtualiser re-renders the row list on every scroll
 * step, and a tile whose asset has not changed has nothing to redo. The
 * callbacks it receives are stable, so the comparison actually holds.
 */
export const AssetTile = memo(function AssetTile({
  asset,
  selected,
  onToggle,
  onMeasure,
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
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const el = tileRef.current;
    if (!el || asset.kind !== "video") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        clearTimeout(timer);
        if (e.isIntersecting) {
          timer = setTimeout(() => setSettled(true), 260);
        } else {
          setSettled(false);
        }
      },
      { rootMargin: "80px" },
    );
    io.observe(el);
    return () => {
      clearTimeout(timer);
      io.disconnect();
    };
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
  // Route raster thumbnails through the image optimizer, which fetches each one
  // once, resizes it, and serves it cached. Direct cross-origin requests to
  // hundreds of origins at once is what left tiles blank and reloaded them on
  // every scroll. SVG is served direct (the optimizer refuses it and it is
  // already tiny), and if the optimizer cannot fetch a host we fall back to the
  // origin.
  const [optFailed, setOptFailed] = useState(false);
  const usingOptimizer = asset.kind === "image" && !optFailed;
  const imgSrc = usingOptimizer
    ? `/_next/image?url=${encodeURIComponent(previewSrc)}&w=420&q=70`
    : previewSrc;
  // A frame we captured on a previous mount, if any.
  const poster = asset.kind === "video" ? cachedPoster(asset.url) : undefined;
  const corner = cornerLabel(asset);
  const showsImage =
    !failed && (asset.kind === "image" || asset.kind === "svg" || !!asset.poster);
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
              }}
              className={
                asset.transparent
                  ? "absolute inset-0 m-auto max-h-[78%] max-w-[78%] object-contain"
                  : "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
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
          ) : showsVideoFrame && settled ? (
            /*
              A frame from the video itself, rendered only while the tile is on
              screen so a whole grid of videos never decodes at once. A media
              fragment plus a seek paints one; once it is up we try to keep a
              copy (see capturePoster) so the next mount is an image.
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
          ) : (
            <TypePlaceholder asset={asset} failed={failed} />
          )}

          {asset.kind === "video" && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
              <span className="ml-[3px] border-y-[6px] border-l-[10px] border-y-transparent border-l-white" />
            </span>
          )}

          {selectable && (
            <span
              aria-hidden
              className={`absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-md border backdrop-blur-sm transition-colors ${
                selected
                  ? "border-accent bg-accent"
                  : "border-white/35 bg-black/40 group-hover:border-white/70"
              }`}
            >
              {selected && (
                <svg
                  viewBox="0 0 12 12"
                  className="h-2.5 w-2.5 text-accent-fg"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M2.5 6.2 4.8 8.5 9.5 3.8" />
                </svg>
              )}
            </span>
          )}

          {asset.section && (
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/90 backdrop-blur-sm">
              {asset.section}
            </span>
          )}

          {corner && (
            <span className="pointer-events-none absolute bottom-2 right-2 z-10 rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur-sm">
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
