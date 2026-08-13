"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset, ScanResult } from "@/lib/types";
import { AssetTile } from "@/components/AssetTile";
import {
  Filters,
  PRESETS,
  applyFilters,
  emptyFilters,
  type FilterState,
} from "@/components/Filters";
import {
  downloadAsZip,
  downloadEachSeparately,
  downloadOne,
  formatBytes,
  openInNewTab,
  type ZipProgress,
} from "@/lib/download";

type Phase = "idle" | "scanning" | "ready" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [measured, setMeasured] = useState<Record<string, { w: number; h: number }>>({});
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Asset | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Merge in dimensions the browser discovered while painting the previews —
  // the scan cannot know them without downloading each file.
  const assets = useMemo(() => {
    if (!result) return [];
    return result.assets.map((a) => {
      const m = measured[a.id];
      return m && !a.width ? { ...a, width: m.w, height: m.h } : a;
    });
  }, [result, measured]);

  const visible = useMemo(() => applyFilters(assets, filters), [assets, filters]);

  const selectedAssets = useMemo(
    () => assets.filter((a) => selected.has(a.id)),
    [assets, selected],
  );
  const selectedBytes = selectedAssets.reduce((n, a) => n + (a.bytes ?? 0), 0);

  const runScan = useCallback(
    async (target: string, d: 1 | 2) => {
      setPhase("scanning");
      setError(null);
      setResult(null);
      setSelected(new Set());
      setMeasured({});
      setNotice(null);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: target, depth: d }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "That scan did not work.");
        setResult(data as ScanResult);
        setFilters(emptyFilters());
        setPhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || phase === "scanning") return;
    runScan(url, depth);
  };

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onMeasure = useCallback((id: string, w: number, h: number) => {
    setMeasured((prev) => (prev[id] ? prev : { ...prev, [id]: { w, h } }));
  }, []);

  // "/" focuses search, the way people expect from every grid tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing && phase === "ready") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  async function handleDownload(mode: "zip" | "each") {
    if (!selectedAssets.length || busy) return;
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: selectedAssets.length, failed: 0 });
    try {
      let host = "pagehaul";
      try {
        host = new URL(result!.target).hostname.replace(/^www\./, "");
      } catch {
        /* fall back to the product name */
      }
      const out =
        mode === "zip"
          ? await downloadAsZip(selectedAssets, `${host}-assets`, setProgress)
          : await downloadEachSeparately(selectedAssets, setProgress);

      if (out.failed.length === 0) {
        setNotice(`Downloaded ${out.added} file${out.added === 1 ? "" : "s"}.`);
      } else if (out.added === 0) {
        setNotice(
          `The source refused all ${out.failed.length} of those. Use "open" on a tile to save them manually.`,
        );
      } else {
        setNotice(
          `Downloaded ${out.added}. ${out.failed.length} were blocked by the source — open those individually.`,
        );
      }
    } catch {
      setNotice("The download could not be completed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleSingle(a: Asset) {
    const out = await downloadOne(a);
    if (!out.ok) {
      setNotice(`${a.name}.${a.format.toLowerCase()} is blocked by its source — opening it instead.`);
      openInNewTab(a);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1240px] px-5 py-8 sm:px-8">
      <header className="mb-8">
        <div className="mb-1 flex items-baseline gap-3">
          <h1 className="font-mono text-lg font-bold tracking-tight">pagehaul</h1>
          <span className="text-sm text-muted">
            Paste any link. Haul exactly the assets you need.
          </span>
        </div>
      </header>

      <form onSubmit={onSubmit} className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter a website link (e.g. stripe.com)"
            aria-label="Website link"
            className="flex-1 rounded border border-line bg-panel px-3 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={phase === "scanning" || !url.trim()}
            className="rounded bg-accent px-5 py-2.5 font-mono text-sm font-semibold uppercase tracking-wider text-ink-inverse transition-opacity disabled:opacity-40"
          >
            {phase === "scanning" ? "Scanning…" : "Scan"}
          </button>
        </div>

        <fieldset className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <legend className="sr-only">Scan scope</legend>
          {(
            [
              [1, "Just this page"],
              [2, "This page and what it links to"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-2">
              <input
                type="radio"
                name="depth"
                checked={depth === v}
                onChange={() => setDepth(v)}
                className="accent-[var(--accent)]"
              />
              {label}
            </label>
          ))}
        </fieldset>
      </form>

      {phase === "idle" && (
        <div className="rounded border border-dashed border-line px-5 py-12 text-center">
          <p className="mb-1 text-[15px] text-fg-2">
            Every image, icon, video, font and document on a page — in one grid.
          </p>
          <p className="text-sm text-muted">
            Filter to what you want, then take one file or all of them. No hunting through a ZIP.
          </p>
        </div>
      )}

      {phase === "scanning" && (
        <div className="rounded border border-line bg-panel px-5 py-8 text-center">
          <p className="font-mono text-sm text-fg-2">Reading the page and its stylesheets…</p>
          <p className="mt-1 text-xs text-muted">This usually takes a few seconds.</p>
        </div>
      )}

      {phase === "error" && (
        <div className="rounded border border-danger/40 bg-danger-soft px-5 py-4">
          <p className="text-sm font-semibold text-danger">{error}</p>
          <button
            type="button"
            onClick={() => runScan(url, depth)}
            className="mt-2 rounded border border-danger/40 px-3 py-1 font-mono text-xs uppercase tracking-wider text-danger"
          >
            Try again
          </button>
        </div>
      )}

      {phase === "ready" && result && (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs text-muted">
            <span>
              <strong className="text-fg">{assets.length}</strong> files found
            </span>
            <span>
              <strong className="text-fg">{result.pages.filter((p) => p.ok).length}</strong>{" "}
              page{result.pages.filter((p) => p.ok).length === 1 ? "" : "s"} read
            </span>
            <span>in {(result.ms / 1000).toFixed(1)}s</span>
          </div>

          {result.notes.length > 0 && (
            <div className="mb-4 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
              {result.notes.join(" ")}
            </div>
          )}

          <div className="flex flex-col gap-5 md:flex-row">
            <Filters assets={assets} filters={filters} onChange={setFilters} />

            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFilters(p.apply(filters))}
                    aria-pressed={p.isOn(filters)}
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
                      p.isOn(filters)
                        ? "border-accent bg-accent text-ink-inverse"
                        : "border-line-strong text-fg-2 hover:border-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <input
                  ref={searchRef}
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search files  ( / )"
                  aria-label="Search files"
                  className="ml-auto w-full max-w-[190px] rounded border border-line bg-panel px-2.5 py-1 text-xs outline-none placeholder:text-muted focus:border-accent"
                />
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="font-mono">
                  Showing <strong className="text-fg">{visible.length}</strong> of {assets.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set(visible.map((a) => a.id)))}
                  className="font-mono text-accent hover:underline"
                >
                  Select all {visible.length} shown
                </button>
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="font-mono hover:underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {visible.length === 0 ? (
                <div className="rounded border border-dashed border-line px-5 py-12 text-center">
                  <p className="text-sm text-fg-2">No files match these filters.</p>
                  <button
                    type="button"
                    onClick={() => setFilters(emptyFilters())}
                    className="mt-2 font-mono text-xs text-accent hover:underline"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {visible.map((a) => (
                    <AssetTile
                      key={a.id}
                      asset={a}
                      selected={selected.has(a.id)}
                      onToggle={toggle}
                      onMeasure={onMeasure}
                      onExpand={setExpanded}
                    />
                  ))}
                </div>
              )}

              <div className="h-24" />
            </div>
          </div>

          {/* Selection bar — always visible so nobody is surprised by what arrives. */}
          {selected.size > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
              <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
                <span className="font-mono text-sm">
                  <strong className="text-accent">{selected.size} selected</strong>
                  <span className="text-muted">
                    {selectedBytes > 0 ? ` · ${formatBytes(selectedBytes)}` : ""}
                  </span>
                </span>

                {progress && (
                  <span className="font-mono text-xs text-muted">
                    {progress.done}/{progress.total}
                    {progress.failed > 0 && ` · ${progress.failed} blocked`}
                  </span>
                )}

                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      selected.size === 1
                        ? handleSingle(selectedAssets[0])
                        : handleDownload("each")
                    }
                    className="rounded border border-line-strong px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg-2 disabled:opacity-40"
                  >
                    {selected.size === 1 ? "Download file" : "Download separately"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDownload("zip")}
                    className="rounded bg-accent px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-inverse disabled:opacity-40"
                  >
                    {busy ? "Working…" : "Download as ZIP"}
                  </button>
                </div>
              </div>
              {notice && (
                <div className="border-t border-line px-5 py-2 text-xs text-fg-2 sm:px-8">
                  {notice}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${expanded.name}`}
          onClick={() => setExpanded(null)}
          className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-3xl overflow-auto rounded border border-line bg-panel p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">
                  {expanded.name}.{expanded.format.toLowerCase()}
                </p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted">
                  {expanded.url.slice(0, 160)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="shrink-0 rounded border border-line px-2 py-1 font-mono text-xs"
              >
                Close
              </button>
            </div>

            {(expanded.kind === "image" || expanded.kind === "svg") && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={expanded.url}
                alt={expanded.alt ?? ""}
                className="mx-auto max-h-[60vh] bg-checker object-contain"
              />
            )}
            {expanded.kind === "video" && (
              <video src={expanded.url} controls poster={expanded.poster} className="w-full" />
            )}
            {expanded.kind === "audio" && (
              <audio src={expanded.url} controls className="w-full" />
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
              {[
                ["Format", expanded.format],
                ["Size", formatBytes(expanded.bytes)],
                [
                  "Dimensions",
                  expanded.width && expanded.height
                    ? `${expanded.width}×${expanded.height}`
                    : "—",
                ],
                ["Origin", expanded.origin],
                ["Section", expanded.section ?? "—"],
                ["Alt text", expanded.alt ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-line py-1">
                  <dt className="text-muted">{k}</dt>
                  <dd className="truncate text-fg-2" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSingle(expanded)}
                className="rounded bg-accent px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-inverse"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(expanded.url)}
                className="rounded border border-line-strong px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg-2"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => openInNewTab(expanded)}
                className="rounded border border-line-strong px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-fg-2"
              >
                Open original
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
