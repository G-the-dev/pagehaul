"use client";

import { useCallback, useMemo, useState } from "react";
import type { Asset, AssetKind, ScanResult } from "@/lib/types";
import { AssetTile } from "@/components/AssetTile";
import { Picker } from "@/components/Picker";
import { Landing } from "@/components/Landing";
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
  { id: "svg", label: "Icons" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "font", label: "Fonts" },
  { id: "document", label: "Docs" },
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

  /** "All" deliberately excludes build artefacts and tracking pixels. */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of assets) {
      c[a.kind] = (c[a.kind] ?? 0) + 1;
      if (!a.noise) c.all += 1;
    }
    return c;
  }, [assets]);

  const visible = useMemo(
    () => (tab === "all" ? assets.filter((a) => !a.noise) : assets.filter((a) => a.kind === tab)),
    [assets, tab],
  );

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

    if (list.length === 1) {
      const out = await downloadOne(list[0]);
      setNotice(
        out.ok
          ? `Downloaded ${list[0].displayName}.`
          : `${list[0].displayName} is blocked by its source — opened it instead.`,
      );
      if (!out.ok) openInNewTab(list[0]);
      setBusy(false);
      return;
    }

    setProgress({ done: 0, total: list.length, failed: 0 });
    try {
      let host = "pagehaul";
      try {
        host = new URL(result!.target).hostname.replace(/^www\./, "");
      } catch {
        /* keep fallback */
      }
      const out = asZip
        ? await downloadAsZip(list, `${host}-assets`, setProgress)
        : await downloadEachSeparately(list, setProgress);

      if (out.failed.length === 0) setNotice(`Downloaded ${out.added} files.`);
      else if (out.added === 0)
        setNotice(
          `All ${out.failed.length} files were refused by the source. Open them individually to save manually.`,
        );
      else
        setNotice(`Downloaded ${out.added}. ${out.failed.length} were blocked by the source.`);
    } catch {
      setNotice("The download could not be completed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const showLanding = phase === "idle" || phase === "error";
  const host = (() => {
    try {
      return new URL(result?.target ?? "").hostname.replace(/^www\./, "");
    } catch {
      return result?.target ?? "";
    }
  })();

  return (
    <main className="min-h-screen">
      {/* ---------------- nav ---------------- */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5 sm:px-8">
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setResult(null);
            }}
            className="flex items-center gap-2.5"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-accent-fg"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">pagehaul</span>
          </button>

          {phase === "ready" && (
            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {host}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setResult(null);
                  setUrl("");
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
              >
                New scan
              </button>
            </div>
          )}
        </div>
      </header>

      {showLanding && (
        <Landing
          url={url}
          setUrl={setUrl}
          deep={deep}
          setDeep={setDeep}
          onScan={() => runScan(url, deep)}
          error={phase === "error" ? error : null}
          onRetry={() => runScan(url, deep)}
        />
      )}

      {/* ---------------- scanning ---------------- */}
      {phase === "scanning" && (
        <section className="mx-auto grid min-h-[62vh] max-w-[1200px] place-items-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-line bg-accent-soft">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
            <p className="text-[17px] font-semibold">
              {deep ? "Opening the page in a browser" : "Reading the page"}
            </p>
            <p className="mx-auto mt-2 max-w-[380px] text-[14px] leading-relaxed text-muted-foreground">
              {deep
                ? "Loading, scrolling to trigger lazy images, and recording every file it fetches. Up to a minute."
                : "Parsing the markup, stylesheets and embedded data. A few seconds."}
            </p>
          </div>
        </section>
      )}

      {/* ---------------- results ---------------- */}
      {phase === "ready" && result && (
        <section className="mx-auto max-w-[1200px] px-6 pb-36 pt-8 sm:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label-mono mb-2 text-accent">Results</div>
              <h1 className="text-[2rem] font-semibold leading-none sm:text-[2.5rem]">
                {counts.all}{" "}
                <span className="text-muted-foreground">
                  file{counts.all === 1 ? "" : "s"}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
              <span>{(result.ms / 1000).toFixed(1)}s</span>
              <span className="h-3 w-px bg-border" />
              <span>{deep ? "deep scan" : "quick scan"}</span>
            </div>
          </div>

          {result.notes.length > 0 && (
            <div className="mb-6 flex gap-3 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3.5">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="mt-0.5 h-4 w-4 shrink-0 text-warn"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
              <p className="text-[13.5px] leading-relaxed text-warn">
                {result.notes.join(" ")}
              </p>
            </div>
          )}

          {!deep && counts.all < 8 && (
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-accent-line bg-accent-soft px-4 py-3.5">
              <p className="text-[13.5px] text-foreground">
                Not much here. This page probably loads its images with JavaScript.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDeep(true);
                  runScan(result.target, true);
                }}
                className="ml-auto rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-fg hover:brightness-110"
              >
                Run deep scan
              </button>
            </div>
          )}

          {/* single-select tabs */}
          <div className="-mx-6 mb-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <div
              role="tablist"
              aria-label="Filter by file type"
              className="flex min-w-max gap-1 rounded-xl border border-border bg-surface-2/60 p-1"
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
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                      active
                        ? "bg-surface text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`font-mono text-[10px] tabular-nums ${
                        active ? "text-accent" : "opacity-60"
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-20 text-center">
              <p className="text-[14px] text-muted-foreground">
                No {activeTabLabel.toLowerCase()} on this page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selected={false}
                  selectable={false}
                  onToggle={() => runDownload([a], false)}
                  onMeasure={onMeasure}
                  onExpand={setExpanded}
                />
              ))}
            </div>
          )}

          {/* action bar */}
          {visible.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-xl">
              <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-6 py-3.5 sm:px-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-semibold tabular-nums">
                    {visible.length}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {activeTabLabel.toLowerCase()}
                    {visibleBytes > 0 && ` · ${formatBytes(visibleBytes)}`}
                  </span>
                </div>

                {progress && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {progress.done}/{progress.total}
                      {progress.failed > 0 && ` · ${progress.failed} blocked`}
                    </span>
                  </div>
                )}

                <div className="ml-auto flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                    className="rounded-lg border border-border-strong px-4 py-2 text-[13.5px] font-medium text-fg-2 transition-colors hover:border-accent hover:text-foreground disabled:opacity-40"
                  >
                    Choose files
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runDownload(visible, true)}
                    className="rounded-lg bg-accent px-5 py-2 text-[13.5px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "Working…" : `Download all ${visible.length}`}
                  </button>
                </div>
              </div>
              {notice && (
                <div className="border-t border-border px-6 py-2 text-[12.5px] text-fg-2 sm:px-8">
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
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl border border-border bg-surface p-6 shadow-lift"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold">{expanded.displayName}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                  {expanded.url.slice(0, 140)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px] text-fg-2 hover:border-border-strong"
              >
                ESC
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              {(expanded.kind === "image" || expanded.kind === "svg") && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={expanded.url}
                  alt={expanded.alt ?? ""}
                  className="mx-auto max-h-[52vh] bg-checker object-contain"
                />
              )}
              {expanded.kind === "video" && (
                <video src={expanded.url} controls poster={expanded.poster} className="w-full" />
              )}
              {expanded.kind === "audio" && (
                <audio src={expanded.url} controls className="w-full p-4" />
              )}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
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
                <div
                  key={k}
                  className="flex items-baseline justify-between gap-3 border-b border-border py-2"
                >
                  <dt className="label-mono text-[9.5px]">{k}</dt>
                  <dd
                    className="truncate font-mono text-[11.5px] text-fg-2"
                    title={String(v)}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => runDownload([expanded], false)}
                className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-accent-fg hover:brightness-110"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(expanded.url)}
                className="rounded-lg border border-border-strong px-4 py-2 text-[13.5px] text-fg-2 hover:border-accent"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => openInNewTab(expanded)}
                className="rounded-lg border border-border-strong px-4 py-2 text-[13.5px] text-fg-2 hover:border-accent"
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
