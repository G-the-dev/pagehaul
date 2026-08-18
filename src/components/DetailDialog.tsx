"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Asset } from "@/lib/types";
import { fetchAsset, formatBytes } from "@/lib/download";
import { thumbnailUrl } from "@/lib/variants";
import { cachedShotThumb } from "@/lib/shot-thumbs";
import { ModelPreview, modelRenderable } from "./ModelPreview";
import { track } from "@/lib/analytics";

/**
 * The full-size look at one file.
 *
 * Its own module so it is fetched when a tile is clicked rather than shipped to
 * everybody who loads the page. Nothing here is reachable until then.
 */

function Key({ children }: { children: React.ReactNode }) {
  return (
    // Border and ink both inherit the button's own colour, so one chip reads
    // correctly on the filled button and the outlined ones alike.
    <kbd className="ml-1.5 rounded border border-current px-1 font-mono text-[9.5px] leading-[1.4] opacity-45">
      {children}
    </kbd>
  );
}

export function DetailDialog({
  asset,
  onClose,
  onDownload,
  position,
  total,
  onPrev,
  onNext,
}: {
  asset: Asset;
  onClose: () => void;
  onDownload: (url: string) => void;
  /** 1-based place in the list behind the dialog, for "12 of 214". */
  position?: number;
  total?: number;
  /** Undefined at the ends of the list, which also disables the control. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "fail">("idle");

  // Which files get looked at, by kind — the arrows fire this as they walk.
  useEffect(() => {
    track("preview", { kind: asset.kind, format: asset.format });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);
  // Which size of the family is chosen. Defaults to the one on the card and
  // drives the preview, the download and the copied address, so a family reads
  // as one file the person tunes rather than a wall of near-duplicates.
  const [selectedUrl, setSelectedUrl] = useState(asset.url);
  useEffect(() => setSelectedUrl(asset.url), [asset.url]);
  const selected = asset.variants?.find((v) => v.url === selectedUrl);
  const selectedLabel = selected?.label ?? null;
  // A family now spans formats, so the size row reads "682x392 · WEBP". Split
  // it back out so the facts below the preview describe the file actually
  // selected, not whichever member happened to be the largest.
  const [selDims, selFormat] = (selectedLabel ?? "").split(" · ");
  const shownFormat = selFormat || asset.format;
  const shownDims =
    selDims || (asset.width && asset.height ? `${asset.width}x${asset.height}` : "n/a");
  const shownBytes = selected?.bytes ?? asset.bytes;
  // What the grid already showed for this file — the same address the tile
  // used, which is the one actually in the browser's cache. The tile routes
  // raster thumbnails through the image optimizer, so the raw thumbnail URL
  // here would have been a fresh download wearing a "cached" comment.
  const previewThumb = (() => {
    if (asset.kind === "screenshot") return cachedShotThumb(asset.id) ?? null;
    const base = asset.thumbUrl ?? asset.poster ?? asset.url;
    const shown = asset.kind === "image" ? (thumbnailUrl(base) ?? base) : base;
    return asset.kind === "image"
      ? `/_next/image?url=${encodeURIComponent(shown)}&w=420&q=70`
      : (asset.thumbUrl ?? thumbnailUrl(asset.url));
  })();
  const panelRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * What the copy button hands over depends on what is open.
   *
   * A screenshot's address is megabytes of base64 nobody can use, and even a
   * hosted picture's URL is one step short of what the person actually wants
   * to put in Figma or a doc — the pixels. So pictures copy as an image, and
   * an icon copies as its SVG source, which Figma pastes as editable vectors
   * and a code editor pastes as markup. Everything else keeps the address.
   */
  const copyMode =
    asset.kind === "svg"
      ? "svg"
      : asset.kind === "image" || asset.kind === "screenshot"
        ? "image"
        : "url";

  const copy = useCallback(() => {
    const flash = (state: "done" | "fail") => {
      if (state === "done") track("copy", { mode: copyMode, kind: asset.kind });
      setCopied(state);
      setTimeout(() => setCopied("idle"), 1800);
    };

    if (copyMode === "url") {
      navigator.clipboard?.writeText(selectedUrl).then(
        () => flash("done"),
        () => flash("fail"),
      );
      return;
    }

    if (copyMode === "svg") {
      // The source text, wherever the icon lives — decoded from its data URL
      // for inline SVG, fetched (with the relay behind it) for a hosted file.
      (async () => {
        const out = await fetchAsset({ ...asset, url: selectedUrl });
        if (!out.ok) throw new Error("unreachable");
        await navigator.clipboard.writeText(
          new TextDecoder().decode(out.bytes),
        );
      })().then(
        () => flash("done"),
        () => flash("fail"),
      );
      return;
    }

    // The clipboard takes pictures as PNG only, so whatever format the file
    // is in gets decoded and re-encoded. The blob goes over as a promise,
    // which keeps the click's permission window open while the bytes arrive.
    try {
      const blobPromise = (async () => {
        const out = await fetchAsset({ ...asset, url: selectedUrl });
        if (!out.ok) throw new Error("unreachable");
        const bitmap = await createImageBitmap(
          new Blob([out.bytes as unknown as BlobPart]),
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        return new Promise<Blob>((res, rej) =>
          canvas.toBlob(
            (b) => (b ? res(b) : rej(new Error("encode failed"))),
            "image/png",
          ),
        );
      })();
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": blobPromise })])
        .then(
          () => flash("done"),
          () => flash("fail"),
        );
    } catch {
      flash("fail");
    }
  }, [copyMode, selectedUrl, asset]);

  // Take focus once, on open, and hold the page behind still. Kept apart from
  // the key handler below: that one depends on props and re-subscribes freely,
  // and if it also restored the scroll style it would save "hidden" over the
  // real value the second time it ran, leaving the page locked after closing.
  useEffect(() => {
    panelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // The dialog advertised Esc without listening for it. Now every key it shows
  // is bound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "d":
        case "D":
          e.preventDefault();
          onDownload(selectedUrl);
          break;
        case "c":
        case "C":
          e.preventDefault();
          copy();
          break;
        case "o":
        case "O":
          // Same gate as the button: a data URL will not open as a tab.
          if (selectedUrl.startsWith("data:")) break;
          e.preventDefault();
          window.open(selectedUrl, "_blank", "noopener,noreferrer");
          break;
        case " ":
        case "k":
        case "K": {
          // Space plays the file without having to click into it first. A
          // dialog holds a video or an audio player, never both; toggle
          // whichever is open, and otherwise let the key be.
          const v = videoRef.current ?? audioRef.current;
          if (!v) break;
          e.preventDefault();
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          break;
        }
        case "ArrowLeft":
          e.preventDefault();
          onPrev?.();
          break;
        case "ArrowRight":
          e.preventDefault();
          onNext?.();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asset, onClose, onDownload, copy, onPrev, onNext, selectedUrl]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${asset.displayName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
    >
      {/* Panel and arrows share one centred wrapper, so the arrows hug the
          panel's edges rather than floating at the far sides of the window.
          min-w-0, because a grid item's default minimum is its content's
          width — the very thing that let a wide image outgrow the screen. */}
      <div className="relative w-full min-w-0 max-w-2xl">
        {onPrev && (
          <button
            type="button"
            aria-label="Previous file"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute right-full top-1/2 z-10 mr-3 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/80 text-muted-foreground backdrop-blur-md transition-colors hover:border-border-strong hover:text-foreground md:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            aria-label="Next file"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute left-full top-1/2 z-10 ml-3 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/80 text-muted-foreground backdrop-blur-md transition-colors hover:border-border-strong hover:text-foreground md:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={panelRef}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[92vh] w-full overflow-auto rounded-xl border border-border bg-surface p-6 shadow-lift outline-none"
        >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{asset.displayName}</p>
            {/* Two lines, hard stop. A CDN address can run to hundreds of
                characters and was pushing the whole panel down before the
                picture even appeared. A data URL is not an address at all —
                a wall of base64 says nothing, so say what the thing is. */}
            <p className="mt-1 line-clamp-2 break-all font-mono text-[11px] leading-[1.5] text-muted-foreground">
              {!asset.url.startsWith("data:")
                ? asset.url
                : asset.kind === "screenshot"
                  ? "Captured from the rendered page by this scan"
                  : "Inline in the page's markup, serialised by the scan"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The chevrons either side of the panel already say the arrows
                work; spelling the keys out as well was clutter. */}
            {position && total && total > 1 && (
              <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground sm:inline">
                {position} of {total}
              </span>
            )}
            {/* The side chevrons live outside the panel and vanish below md,
                which left a phone with no way to step at all. These stand in
                where a thumb can reach them. */}
            {(onPrev || onNext) && (
              <span className="flex items-center gap-1.5 md:hidden">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!onPrev}
                  aria-label="Previous file"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!onNext}
                  aria-label="Next file"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              ESC
            </button>
          </div>
        </div>

        {(asset.kind === "image" ||
          asset.kind === "svg" ||
          asset.kind === "screenshot") && (
          <div
            className={`relative rounded-lg border border-border ${
              // A full-page capture is many screens tall; contained in 46vh it
              // would shrink to a sliver. Full width, scrolled within the box,
              // reads like the page it is a picture of.
              asset.kind === "screenshot"
                ? "max-h-[46vh] overflow-y-auto"
                : "overflow-hidden"
            }`}
          >
            {/* The full file can be megabytes and arrive slowly. The tile's
                thumbnail is already in the browser's cache, so it stands in —
                blurred and dimmed so it reads as "loading", not as the image —
                until the real one paints over it. */}
            {previewThumb && !asset.transparent && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewThumb}
                alt=""
                aria-hidden
                decoding="async"
                className="absolute inset-0 h-full w-full scale-105 object-cover opacity-40 blur-lg"
              />
            )}
            {/* Keyed by the file, so stepping with the arrows unmounts the
                old picture at once. Without the key the browser holds the
                previous image in the element until the new one arrives, and
                the dialog reads as changed everywhere except the picture. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={asset.id}
              src={selectedUrl}
              alt={asset.alt ?? ""}
              decoding="async"
              className={
                asset.kind === "screenshot"
                  ? "relative w-full"
                  : // max-w-full matters: without it a wide photo's intrinsic
                    // width becomes the panel's minimum, and on a phone the
                    // whole dialog grew past the screen and clipped its edge.
                    "relative mx-auto max-h-[46vh] max-w-full bg-checker object-contain"
              }
            />
          </div>
        )}
        {asset.kind === "video" && (
          <video
            ref={videoRef}
            key={selectedUrl}
            src={selectedUrl}
            controls
            poster={asset.poster}
            className="max-h-[46vh] w-full rounded-lg"
          />
        )}
        {asset.kind === "model" && modelRenderable(selectedUrl) && (
          // The model itself, turnable. Judging a 3D file from its filename
          // was the whole complaint; here it can be looked around.
          <div className="h-[46vh] overflow-hidden rounded-lg border border-border bg-surface-2/40">
            <ModelPreview key={selectedUrl} url={selectedUrl} interactive />
          </div>
        )}
        {asset.kind === "audio" && (
          // Keyed so stepping between files with the arrows swaps the player
          // rather than leaving the last file's audio loaded in it.
          <audio
            ref={audioRef}
            key={selectedUrl}
            src={selectedUrl}
            controls
            preload="metadata"
            className="w-full"
          />
        )}
        {asset.preview && (
          <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-fg-2">
            {asset.preview}
          </pre>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
          {(
            [
              ["Format", shownFormat],
              ["Size", formatBytes(shownBytes)],
              ["Dimensions", shownDims],
              ["Method", asset.method ?? "n/a"],
              ["Status", asset.status?.toString() ?? "n/a"],
              ["Origin", asset.origin],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between gap-3 border-b border-border py-2"
            >
              <dt className="label-mono text-[9.5px]">{k}</dt>
              <dd className="truncate font-mono text-[11.5px] text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Collapsing a family must not make its members unreachable, but the
            answer is a few useful sizes on one line, not the CDN's whole
            ladder. The one on the card is marked. */}
        {asset.variants && asset.variants.length > 1 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="label-mono text-[9.5px]">Size &amp; format</span>
            {asset.variants.map((v) => {
              const current = v.url === selectedUrl;
              return (
                <button
                  key={v.url}
                  type="button"
                  onClick={() => setSelectedUrl(v.url)}
                  aria-pressed={current}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    current
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onDownload(selectedUrl)}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg transition-all hover:brightness-110"
          >
            Download
            <Key>D</Key>
          </button>
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-4 text-[13px] transition-colors ${
              copied !== "idle"
                ? "border-accent-line text-foreground"
                : "border-border hover:border-border-strong"
            }`}
          >
            {copied === "done" ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Copied
              </>
            ) : copied === "fail" ? (
              "Could not copy"
            ) : (
              <>
                {copyMode === "image"
                  ? "Copy image"
                  : copyMode === "svg"
                    ? "Copy SVG"
                    : "Copy URL"}
                <Key>C</Key>
              </>
            )}
          </button>
          {/* A data URL cannot be opened as a tab — the browser blocks the
              navigation — so the button only appears for a fetchable address. */}
          {!selectedUrl.startsWith("data:") && (
            <button
              type="button"
              onClick={() => window.open(selectedUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-[13px] transition-colors hover:border-border-strong"
            >
              Open original
              <Key>O</Key>
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
