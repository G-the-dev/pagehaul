"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Asset } from "@/lib/types";
import { formatBytes, openInNewTab } from "@/lib/download";

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
  onDownload: () => void;
  /** 1-based place in the list behind the dialog, for "12 of 214". */
  position?: number;
  total?: number;
  /** Undefined at the ends of the list, which also disables the control. */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const copy = useCallback(() => {
    navigator.clipboard?.writeText(asset.url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {
        // Clipboard access can be refused. The address is selectable anyway.
      },
    );
  }, [asset.url]);

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
          onDownload();
          break;
        case "c":
        case "C":
          e.preventDefault();
          copy();
          break;
        case "o":
        case "O":
          e.preventDefault();
          openInNewTab(asset);
          break;
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
  }, [asset, onClose, onDownload, copy, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${asset.displayName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
    >
      {/* Stepping through the list without closing first. Sat outside the
          panel so they never cover the thing being looked at, and hidden at
          the ends rather than shown dead. */}
      {onPrev && (
        <button
          type="button"
          aria-label="Previous file"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/80 text-muted-foreground backdrop-blur-md transition-colors hover:border-border-strong hover:text-foreground md:grid"
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
          className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/80 text-muted-foreground backdrop-blur-md transition-colors hover:border-border-strong hover:text-foreground md:grid"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-2xl overflow-auto rounded-xl border border-border bg-surface p-6 shadow-lift outline-none"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{asset.displayName}</p>
            {/* Two lines, hard stop. A CDN address can run to hundreds of
                characters and was pushing the whole panel down before the
                picture even appeared. */}
            <p className="mt-1 line-clamp-2 break-all font-mono text-[11px] leading-[1.5] text-muted-foreground">
              {asset.url}
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

        {(asset.kind === "image" || asset.kind === "svg") && (
          <div className="overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.url}
              alt={asset.alt ?? ""}
              className="mx-auto max-h-[46vh] bg-checker object-contain"
            />
          </div>
        )}
        {asset.kind === "video" && (
          <video src={asset.url} controls poster={asset.poster} className="w-full rounded-lg" />
        )}
        {asset.preview && (
          <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-fg-2">
            {asset.preview}
          </pre>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
          {(
            [
              ["Format", asset.format],
              ["Size", formatBytes(asset.bytes)],
              [
                "Dimensions",
                asset.width && asset.height ? `${asset.width}x${asset.height}` : "n/a",
              ],
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
            <span className="label-mono text-[9.5px]">Size</span>
            {asset.variants.map((v) => {
              const current = v.url === asset.url;
              return (
                <a
                  key={v.url}
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                    current
                      ? "border-accent-line text-foreground"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {v.label}
                </a>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onDownload}
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
              copied
                ? "border-accent-line text-foreground"
                : "border-border hover:border-border-strong"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                Copied
              </>
            ) : (
              <>
                Copy URL
                <Key>C</Key>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => openInNewTab(asset)}
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-[13px] transition-colors hover:border-border-strong"
          >
            Open original
            <Key>O</Key>
          </button>
        </div>
      </div>
    </div>
  );
}
