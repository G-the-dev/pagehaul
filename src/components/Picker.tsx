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
 * The picker opens on top of the results with everything pre-selected, so
 * "choose files" starts from the same place "download all" would have — the
 * user removes what they do not want rather than building a selection up.
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[860px] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-bg shadow-2xl"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">Choose what to download</h2>
            <p className="mt-0.5 text-xs text-muted">
              Everything is selected. Untick anything you do not want.
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search files"
            className="ml-auto w-full max-w-[200px] rounded border border-line bg-panel px-2.5 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-line px-2.5 py-1.5 font-mono text-xs text-fg-2 hover:border-line-strong"
          >
            Esc
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-5 py-2 text-xs">
          <span className="font-mono text-muted">
            <strong className="text-fg">{selected.size}</strong> of {assets.length} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set(shown.map((a) => a.id)))}
            className="font-mono text-accent hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="font-mono text-muted hover:underline"
          >
            Select none
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {shown.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">Nothing matches that search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
                    onExpand={() => {}}
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-panel px-5 py-3">
          <span className="font-mono text-sm">
            <strong className="text-accent">{selected.size} file{selected.size === 1 ? "" : "s"}</strong>
            {totalBytes > 0 && <span className="text-muted"> · {formatBytes(totalBytes)}</span>}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-line-strong px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-fg-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(chosen, false)}
              className="rounded border border-line-strong px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-fg-2 disabled:opacity-40"
            >
              Separate files
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => onConfirm(chosen, true)}
              className="rounded bg-accent px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink-inverse disabled:opacity-40"
            >
              Download {selected.size}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
