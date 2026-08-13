"use client";

import { useState } from "react";
import type { Asset } from "@/lib/types";
import { formatBytes } from "@/lib/download";

interface Props {
  asset: Asset;
  selected: boolean;
  onToggle: (id: string) => void;
  onMeasure: (id: string, w: number, h: number) => void;
  onExpand: (asset: Asset) => void;
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

export function AssetTile({
  asset,
  selected,
  onToggle,
  onMeasure,
  onExpand,
  compact,
  selectable = true,
}: Props) {
  const [failed, setFailed] = useState(false);
  // Preview the smallest known variant, never the full-size original.
  const previewSrc = asset.thumbUrl ?? asset.poster ?? asset.url;
  const corner = cornerLabel(asset);
  const showsImage =
    !failed && (asset.kind === "image" || asset.kind === "svg" || !!asset.poster);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-surface transition-all duration-200 ${
        selected
          ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
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
            : `Download ${asset.displayName}`
        }
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={`relative aspect-[4/3] w-full overflow-hidden ${
            asset.transparent && showsImage ? "bg-checker" : "bg-surface-2"
          }`}
        >
          {showsImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth) onMeasure(asset.id, el.naturalWidth, el.naturalHeight);
              }}
              className={
                asset.transparent
                  ? "absolute inset-0 m-auto max-h-[78%] max-w-[78%] object-contain"
                  : "h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              }
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

      {!compact && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand(asset);
          }}
          aria-label={`Preview ${asset.displayName}`}
          className="absolute bottom-[46px] left-2 z-20 hidden rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] text-white/90 backdrop-blur-sm hover:bg-black/75 group-hover:block focus:block focus:outline-none"
        >
          preview
        </button>
      )}

      <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
        <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-px font-mono text-[9.5px] font-semibold tracking-wide text-fg-2">
          {asset.format}
        </span>
        <span
          className="flex-1 truncate text-[12px] text-fg-2"
          title={`${asset.displayName} — ${asset.url}`}
        >
          {asset.displayName}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatBytes(asset.bytes)}
        </span>
      </div>
    </div>
  );
}

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
