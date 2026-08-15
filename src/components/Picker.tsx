"use client";

import { useEffect, useMemo, useState } from "react";
import type { Asset } from "@/lib/types";
import { AssetTile } from "./AssetTile";
import { formatBytes } from "@/lib/download";

interface Props {
  /** Already narrowed to the tab the user was looking at. */
  assets: Asset[];
  tabLabel: string;
  onClose: () => void;
  onConfirm: (chosen: Asset[], asZip: boolean) => void;
}

/**
 * Opens with everything pre-selected, so "choose files" starts from the same
 * place "download all" would have — the user removes what they do not want
 * rather than building a selection from nothing.
 */
export function Picker({ assets, tabLabel, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(assets.map((a) => a.id)),
  );
  const [query, setQuery] = useState("");
  const [measured, setMeasured] = useState<Record<string, { w: number; h: number }>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      `${a.displayName} ${a.format} ${a.url}`.toLowerCase().includes(q),
    );
  }, [assets, query]);

  const chosen = assets.filter((a) => selected.has(a.id));
  const totalBytes = chosen.reduce((n, a) => n + (a.bytes ?? 0), 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Choose which ${tabLabel.toLowerCase()} to download`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[880px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lift"
      >
        {/* header */}
        <div className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="label-mono mb-1.5 text-accent">Select</div>
            <h2 className="text-[17px] font-semibold leading-none">
              Choose what to download
            </h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Everything is selected. Untick anything you do not want.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              aria-label="Search files"
              className="w-[190px] rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-accent"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-border px-2.5 py-2 font-mono text-[11px] text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
            >
              ESC
            </button>
          </div>
        </div>

        {/* selection controls */}
        <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface-2/50 px-6 py-2.5">
          <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
            <strong className="text-foreground">{selected.size}</strong> of {assets.length}
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set(shown.map((a) => a.id)))}
            className="text-[12.5px] font-medium text-accent transition-opacity hover:opacity-75"
          >
            Select all{query ? " shown" : ""}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>

        {/* grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {shown.length === 0 ? (
            <p className="py-20 text-center text-[14px] text-muted-foreground">
              Nothing matches that search.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {shown.map((a) => {
                const m = measured[a.id];
                const withDims = m && !a.width ? { ...a, width: m.w, height: m.h } : a;
                return (
                  <AssetTile
                    key={a.id}
                    asset={withDims}
                    selected={selected.has(a.id)}
                    onToggle={toggle}
                    onMeasure={(id, w, h) =>
                      setMeasured((p) => (p[id] ? p : { ...p, [id]: { w, h } }))
                    }
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border bg-surface/70 px-6 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold tabular-nums text-accent">
              {selected.size}
            </span>
            <span className="text-[13px] text-muted-foreground">
              file{selected.size === 1 ? "" : "s"}
              {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-[13.5px] font-medium text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(chosen, false)}
              className="rounded-lg border border-border-strong px-4 py-2 text-[13.5px] font-medium text-fg-2 transition-colors hover:border-accent hover:text-foreground disabled:opacity-40"
            >
              Separate files
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(chosen, true)}
              className="rounded-lg bg-accent px-5 py-2 text-[13.5px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
            >
              Download {selected.size}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
