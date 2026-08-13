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
  /** Hides the hover "view" affordance inside the picker, where click means select. */
  compact?: boolean;
}

/** Dimensions or duration, whichever this kind of file is judged on. */
function cornerLabel(a: Asset): string | null {
  if (a.width && a.height) return `${a.width}×${a.height}`;
  if (a.kind === "video") return "video";
  return null;
}

function Checkerboard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-checker">{children}</div>
  );
}

export function AssetTile({
  asset,
  selected,
  onToggle,
  onMeasure,
  onExpand,
  compact,
}: Props) {
  const [failed, setFailed] = useState(false);
  // Preview the smallest known variant — never pull the full-size original
  // just to paint a 180px tile.
  const previewSrc = asset.thumbUrl ?? asset.poster ?? asset.url;
  const corner = cornerLabel(asset);

  const showsImage =
    !failed && (asset.kind === "image" || asset.kind === "svg" || asset.poster);

  return (
    <div
      className={`group relative overflow-hidden rounded border bg-panel transition-colors ${
        selected ? "border-accent ring-1 ring-accent" : "border-line hover:border-line-strong"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(asset.id)}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${asset.displayName}`}
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-tile">
          {showsImage ? (
            asset.transparent ? (
              <Checkerboard>
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  className="max-h-full max-w-full object-contain p-2"
                />
              </Checkerboard>
            ) : (
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
                className="h-full w-full object-cover"
              />
            )
          ) : (
            <TypePlaceholder asset={asset} failed={failed} />
          )}

          {asset.kind === "video" && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55">
              <span className="ml-1 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
            </span>
          )}

          <span
            aria-hidden
            className={`absolute right-1.5 top-1.5 z-10 grid h-[19px] w-[19px] place-items-center rounded border ${
              selected
                ? "border-accent bg-accent"
                : "border-white/45 bg-black/45 group-hover:border-white/70"
            }`}
          >
            {selected && (
              <span className="mb-[3px] h-[5px] w-[9px] -rotate-45 border-b-2 border-l-2 border-ink-inverse" />
            )}
          </span>

          {asset.section && (
            <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/90">
              {asset.section}
            </span>
          )}

          {corner && (
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/90">
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
        aria-label={`Preview ${asset.name}`}
        className="absolute bottom-[38px] left-1.5 z-20 hidden rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/90 hover:bg-black/80 group-hover:block focus:block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        view
      </button>
      )}

      <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5 font-mono text-[10px] text-muted">
        <span className="shrink-0 rounded border border-line bg-tile px-1 py-px font-semibold text-fg-2">
          {asset.format}
        </span>
        <span
          className="flex-1 truncate"
          title={`${asset.displayName} — ${asset.url}`}
        >
          {asset.displayName}
        </span>
        <span className="shrink-0 tabular-nums">{formatBytes(asset.bytes)}</span>
      </div>
    </div>
  );
}

/** Every type that has no natural picture gets something better than a file icon. */
function TypePlaceholder({ asset, failed }: { asset: Asset; failed: boolean }) {
  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 text-center">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-line-strong font-mono text-[11px] text-muted">
          !
        </span>
        <span className="font-mono text-[9px] leading-tight text-muted">
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
        <div className="flex h-full flex-col items-center justify-center gap-1">
          <span className="font-serif text-4xl leading-none text-fg-2">Aa</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
            {asset.format}
          </span>
        </div>
      );
    case "audio":
      return (
        <div className="flex h-full items-center justify-center gap-[3px] px-6">
          {[22, 48, 80, 56, 100, 38, 70, 26, 60, 44, 86, 30].map((h, i) => (
            <span
              key={i}
              style={{ height: `${h * 0.42}%` }}
              className="w-full max-w-[4px] flex-1 rounded-sm bg-accent/70"
            />
          ))}
        </div>
      );
    case "document":
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex h-[70%] w-[52%] flex-col gap-[3px] rounded-sm border border-line-strong bg-panel p-2">
            {[78, 100, 60, 100, 78, 60].map((w, i) => (
              <span
                key={i}
                style={{ width: `${w}%` }}
                className="h-[3px] rounded-sm bg-tile-2"
              />
            ))}
          </div>
        </div>
      );
    case "code":
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex w-[66%] flex-col gap-1">
            {[80, 55, 70, 42].map((w, i) => (
              <span
                key={i}
                style={{ width: `${w}%` }}
                className={`h-1 rounded-sm ${i === 1 ? "bg-accent/50" : "bg-tile-2"}`}
              />
            ))}
          </div>
        </div>
      );
    case "data":
      return (
        <div className="grid h-full place-items-center">
          <span className="font-mono text-xs uppercase tracking-widest text-muted">
            {asset.format}
          </span>
        </div>
      );
    default:
      return (
        <div className="grid h-full place-items-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {asset.format}
          </span>
        </div>
      );
  }
}
