"use client";

import { useCallback, useMemo, useState } from "react";
import type { Asset, AssetKind, ScanResult } from "@/lib/types";
import { AssetTile } from "@/components/AssetTile";
import { Picker } from "@/components/Picker";
import {
  downloadAsZip,
  downloadEachSeparately,
  downloadOne,
  formatBytes,
  openInNewTab,
  type ZipProgress,
} from "@/lib/download";

type Phase = "idle" | "scanning" | "ready" | "error";
type Tab = "all" | AssetKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "svg", label: "Icons & SVG" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "font", label: "Fonts" },
  { id: "document", label: "Documents" },
  { id: "code", label: "Code" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [deep, setDeep] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [measured, setMeasured] = useState<Record<string, { w: number; h: number }>>({});
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Asset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const assets = useMemo(() => {
    if (!result) return [];
    return result.assets.map((a) => {
      const m = measured[a.id];
      return m && !a.width ? { ...a, width: m.w, height: m.h } : a;
    });
  }, [result, measured]);

  /** Counts per tab. "All" deliberately excludes build artefacts and tracking pixels. */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of assets) {
      c[a.kind] = (c[a.kind] ?? 0) + 1;
      if (!a.noise) c.all += 1;
    }
    return c;
  }, [assets]);

  const visible = useMemo(() => {
    if (tab === "all") return assets.filter((a) => !a.noise);
    return assets.filter((a) => a.kind === tab);
  }, [assets, tab]);

  const visibleBytes = visible.reduce((n, a) => n + (a.bytes ?? 0), 0);
  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "Files";

  const runScan = useCallback(async (target: string, useDeep: boolean) => {
    setPhase("scanning");
    setError(null);
    setResult(null);
    setMeasured({});
    setNotice(null);
    setTab("all");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target, deep: useDeep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That scan did not work.");
      setResult(data as ScanResult);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("error");
    }
  }, []);

  const onMeasure = useCallback((id: string, w: number, h: number) => {
    setMeasured((prev) => (prev[id] ? prev : { ...prev, [id]: { w, h } }));
  }, []);

  async function runDownload(list: Asset[], asZip: boolean) {
    if (!list.length || busy) return;
    setBusy(true);
    setNotice(null);
    setProgress({ done: 0, total: list.length, failed: 0 });

    if (list.length === 1) {
      const out = await downloadOne(list[0]);
      if (!out.ok) {
        setNotice(`${list[0].displayName} is blocked by its source — opening it instead.`);
        openInNewTab(list[0]);
      } else {
        setNotice(`Downloaded ${list[0].displayName}.`);
      }
      setBusy(false);
      setProgress(null);
      return;
    }

    try {
      let host = "pagehaul";
      try {
        host = new URL(result!.target).hostname.replace(/^www\./, "");
      } catch {
        /* keep the fallback */
      }
      const out = asZip
        ? await downloadAsZip(list, `${host}-assets`, setProgress)
        : await downloadEachSeparately(list, setProgress);

      if (out.failed.length === 0) {
        setNotice(`Downloaded ${out.added} files.`);
      } else if (out.added === 0) {
        setNotice(
          `The source refused all ${out.failed.length} files. Open them individually from a tile to save them manually.`,
        );
      } else {
        setNotice(
          `Downloaded ${out.added}. ${out.failed.length} were blocked by the source.`,
        );
      }
    } catch {
      setNotice("The download could not be completed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const showLanding = phase === "idle" || phase === "error";

  return (
    <main className="min-h-screen">
      {/* ---------------- header ---------------- */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResult(null);
            }}
            className="font-mono text-[15px] font-bold tracking-tight"
          >
            pagehaul
          </button>
          {phase === "ready" && (
            <button
              type="button"
              onClick={() => {
                setPhase("idle");
                setResult(null);
                setUrl("");
              }}
              className="font-mono text-xs uppercase tracking-wider text-muted hover:text-fg"
            >
              New scan
            </button>
          )}
        </div>
      </header>

      {/* ---------------- landing ---------------- */}
      {showLanding && (
        <>
          <section className="mx-auto max-w-[1240px] px-5 pb-12 pt-16 sm:px-8 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Take exactly the assets
                <br className="hidden sm:block" /> you need from any page.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-fg-2 sm:text-lg">
                Paste a link and get every image, icon, video, font and document on
                the page — in one grid. Grab a single file or all of them. No DevTools,
                no ZIP to dig through.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (url.trim()) runScan(url, deep);
                }}
                className="mx-auto mt-9 max-w-2xl"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    inputMode="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="stripe.com"
                    aria-label="Website link"
                    className="flex-1 rounded-lg border border-line bg-panel px-4 py-3.5 text-[15px] outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className="rounded-lg bg-accent px-7 py-3.5 text-sm font-semibold text-ink-inverse transition-opacity disabled:opacity-40"
                  >
                    Scan page
                  </button>
                </div>

                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-[13px] text-fg-2">
                  <input
                    type="checkbox"
                    checked={deep}
                    onChange={(e) => setDeep(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Deep scan — opens the page in a real browser and scrolls it, to catch
                  images loaded by JavaScript. Slower, but finds far more.
                </label>
              </form>

              {phase === "error" && (
                <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-left">
                  <p className="text-sm font-medium text-danger">{error}</p>
                  <button
                    type="button"
                    onClick={() => runScan(url, deep)}
                    className="mt-2 font-mono text-xs uppercase tracking-wider text-danger underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
            <div className="grid gap-6 border-t border-line pt-10 sm:grid-cols-3">
              {[
                {
                  h: "Paste a link",
                  p: "Any public page. We read the HTML, its stylesheets and its embedded data to find every file it references.",
                },
                {
                  h: "See everything at once",
                  p: "A grid of real previews — images, icons, video, fonts, documents — with readable names, formats and sizes.",
                },
                {
                  h: "Take only what you want",
                  p: "One click for one file. Or pick a set and get a tidy archive. Nothing to unzip and search through.",
                },
              ].map((s, i) => (
                <div key={s.h}>
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mb-1.5 text-[15px] font-semibold">{s.h}</h3>
                  <p className="text-sm leading-relaxed text-fg-2">{s.p}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-lg border border-line bg-panel px-5 py-5">
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                What it finds
              </h3>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-2">
                {[
                  "JPG, PNG, WebP, AVIF, GIF",
                  "SVG icons & sprites",
                  "Every srcset size",
                  "CSS backgrounds",
                  "Video & posters",
                  "Web fonts",
                  "PDFs & documents",
                  "Favicons & social images",
                ].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ---------------- scanning ---------------- */}
      {phase === "scanning" && (
        <section className="mx-auto max-w-[1240px] px-5 py-24 text-center sm:px-8">
          <p className="text-lg font-medium">
            {deep ? "Opening the page in a browser…" : "Reading the page…"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {deep
              ? "Loading, scrolling to trigger lazy images, and recording every file it fetches. Up to a minute."
              : "Parsing the HTML and stylesheets. A few seconds."}
          </p>
        </section>
      )}

      {/* ---------------- results ---------------- */}
      {phase === "ready" && result && (
        <section className="mx-auto max-w-[1240px] px-5 pb-32 pt-6 sm:px-8">
          <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold">
              {counts.all} file{counts.all === 1 ? "" : "s"} found
            </h2>
            <span className="font-mono text-xs text-muted">
              {(() => {
                try {
                  return new URL(result.target).hostname;
                } catch {
                  return result.target;
                }
              })()}{" "}
              · {(result.ms / 1000).toFixed(1)}s
            </span>
          </div>

          {result.notes.length > 0 && (
            <div className="mb-5 rounded-lg border border-warn/40 bg-warn-soft px-4 py-3 text-sm leading-relaxed text-warn">
              {result.notes.join(" ")}
            </div>
          )}

          {/* Offer the stronger engine when a quick scan came back thin. */}
          {!deep && counts.all < 8 && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3">
              <p className="text-sm text-fg-2">
                Not many files here. This page probably loads its images with JavaScript.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeep(true);
                  runScan(result.target, true);
                }}
                className="ml-auto rounded bg-accent px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-inverse"
              >
                Run deep scan
              </button>
            </div>
          )}

          {/* Single-select tabs. One filter at a time, nothing to combine. */}
          <div className="-mx-5 mb-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <div
              role="tablist"
              aria-label="Filter by file type"
              className="flex min-w-max gap-1 border-b border-line"
            >
              {TABS.map((t) => {
                const n = t.id === "all" ? counts.all : (counts[t.id] ?? 0);
                if (n === 0 && t.id !== "all") return null;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-accent font-semibold text-accent"
                        : "border-transparent text-fg-2 hover:text-fg"
                    }`}
                  >
                    {t.label}
                    <span className="font-mono text-[11px] tabular-nums opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              No {activeTabLabel.toLowerCase()} on this page.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selected={false}
                  onToggle={() => runDownload([a], false)}
                  onMeasure={onMeasure}
                  onExpand={setExpanded}
                />
              ))}
            </div>
          )}

          {/* Two actions, exactly as specified. */}
          {visible.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 backdrop-blur">
              <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
                <span className="font-mono text-sm">
                  <strong>{visible.length}</strong>{" "}
                  <span className="text-muted">
                    {activeTabLabel.toLowerCase()}
                    {visibleBytes > 0 ? ` · ${formatBytes(visibleBytes)}` : ""}
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
                    onClick={() => setPickerOpen(true)}
                    className="rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-fg-2 hover:border-accent hover:text-fg disabled:opacity-40"
                  >
                    Choose files…
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runDownload(visible, true)}
                    className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-ink-inverse disabled:opacity-40"
                  >
                    {busy ? "Working…" : `Download all ${visible.length}`}
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
        </section>
      )}

      {pickerOpen && (
        <Picker
          assets={visible}
          tabLabel={activeTabLabel}
          onClose={() => setPickerOpen(false)}
          onConfirm={(chosen, asZip) => {
            setPickerOpen(false);
            runDownload(chosen, asZip);
          }}
        />
      )}

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${expanded.displayName}`}
          onClick={() => setExpanded(null)}
          className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-3xl overflow-auto rounded-lg border border-line bg-panel p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{expanded.displayName}</p>
                <p className="mt-0.5 break-all font-mono text-[11px] text-muted">
                  {expanded.url.slice(0, 150)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="shrink-0 rounded border border-line px-2.5 py-1 font-mono text-xs"
              >
                Close
              </button>
            </div>

            {(expanded.kind === "image" || expanded.kind === "svg") && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={expanded.url}
                alt={expanded.alt ?? ""}
                className="mx-auto max-h-[58vh] bg-checker object-contain"
              />
            )}
            {expanded.kind === "video" && (
              <video src={expanded.url} controls poster={expanded.poster} className="w-full" />
            )}
            {expanded.kind === "audio" && <audio src={expanded.url} controls className="w-full" />}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 font-mono text-[11px] sm:grid-cols-3">
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
                <div key={k} className="flex justify-between gap-2 border-b border-line py-1.5">
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
                onClick={() => runDownload([expanded], false)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink-inverse"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(expanded.url)}
                className="rounded-lg border border-line-strong px-3.5 py-2 text-sm text-fg-2"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => openInNewTab(expanded)}
                className="rounded-lg border border-line-strong px-3.5 py-2 text-sm text-fg-2"
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
