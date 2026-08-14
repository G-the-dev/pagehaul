"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Asset, AssetKind, ScanResult } from "@/lib/types";
import { AssetTile } from "@/components/AssetTile";
import { Picker } from "@/components/Picker";
import { Hero } from "@/components/Hero";
import { ScanProgress } from "@/components/ScanProgress";
import { DesignPanel } from "@/components/DesignPanel";
import { Faq, Footer } from "@/components/Sections";
import { Features, Audience, Steps } from "@/components/Features";
import {
  downloadAsZip,
  downloadEachSeparately,
  downloadOne,
  formatBytes,
  openInNewTab,
  type ZipProgress,
} from "@/lib/download";

type Tab = "all" | AssetKind | "design";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "svg", label: "Icons" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "font", label: "Fonts" },
  { id: "document", label: "Docs" },
  { id: "api", label: "Network" },
  { id: "code", label: "Code" },
  { id: "data", label: "Data" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [deep, setDeep] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [measured, setMeasured] = useState<Record<string, { w: number; h: number }>>({});
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Asset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shown, setShown] = useState(48);
  const resultsRef = useRef<HTMLDivElement>(null);

  const assets = useMemo(() => {
    if (!result) return [];
    return result.assets.map((a) => {
      const m = measured[a.id];
      return m && !a.width ? { ...a, width: m.w, height: m.h } : a;
    });
  }, [result, measured]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of assets) {
      c[a.kind] = (c[a.kind] ?? 0) + 1;
      if (!a.noise) c.all += 1;
    }
    return c;
  }, [assets]);

  const visible = useMemo(() => {
    if (tab === "design") return [];
    if (tab === "all") return assets.filter((a) => !a.noise);
    return assets.filter((a) => a.kind === tab);
  }, [assets, tab]);

  const visibleBytes = visible.reduce((n, a) => n + (a.bytes ?? 0), 0);
  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "Files";
  const hasDesign =
    (result?.palette?.length ?? 0) > 0 || (result?.typography?.length ?? 0) > 0;

  const runScan = useCallback(async (target: string, useDeep: boolean) => {
    setScanning(true);
    setError(null);
    setMeasured({});
    setNotice(null);
    setTab("all");
    setShown(48);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target, deep: useDeep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That scan did not work.");
      setResult(data as ScanResult);
      setShown(48);
      // Results render inline, so bring them into view without a page change.
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setResult(null);
    } finally {
      setScanning(false);
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
          : `${list[0].displayName} is blocked by its source, so it opened in a new tab instead.`,
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
        setNotice(`All ${out.failed.length} files were refused by the source.`);
      else setNotice(`Downloaded ${out.added}. ${out.failed.length} were blocked.`);
    } catch {
      setNotice("The download could not be completed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const host = (() => {
    try {
      return new URL(result?.target ?? "").hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  return (
    <main id="top" className="min-h-screen">
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-6">
        <nav className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-surface/70 py-2 pl-6 pr-2 backdrop-blur-xl">
          <a href="#top" className="pr-4 text-[14px] font-semibold tracking-tight">
            pagehaul
          </a>
          <span className="mr-1.5 h-4 w-px bg-border" />
          {[
            ["What you get", "#what"],
            ["How", "#how"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <a
            href="https://github.com/G-the-dev/pagehaul"
            target="_blank"
            rel="noreferrer"
            className="ml-1.5 rounded-full bg-foreground px-5 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            GitHub
          </a>
        </nav>
      </header>

      <Hero
        url={url}
        setUrl={setUrl}
        deep={deep}
        setDeep={setDeep}
        onScan={() => runScan(url, deep)}
        onPick={(host) => {
          setUrl(host);
          runScan(host, deep);
        }}
        scanning={scanning}
        error={error}
      />

      {/* Results live on the same page, directly under the input, so a new
          link is always one scroll away. */}
      {result && (
        <section ref={resultsRef} className="relative">
          <div className="mx-auto max-w-[1400px] px-6 py-10">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[1.6rem] font-medium tracking-tight">
                {counts.all}{" "}
                <span className="text-muted-foreground">
                  file{counts.all === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                <span>{host}</span>
                <span className="h-3 w-px bg-border" />
                <span>{(result.ms / 1000).toFixed(1)}s</span>
                <span className="h-3 w-px bg-border" />
                <span>{deep ? "deep" : "quick"}</span>
              </div>
            </div>

            {result.notes.length > 0 && (
              <div className="mb-6 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px] leading-relaxed text-warn">
                {result.notes.join(" ")}
              </div>
            )}

            {!deep && counts.all < 10 && (
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3">
                <p className="text-[13.5px]">
                  This page loads most of its content with JavaScript.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeep(true);
                    runScan(result.target, true);
                  }}
                  className="ml-auto rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-fg"
                >
                  Run deep scan
                </button>
              </div>
            )}

            {/* tabs */}
            <div className="-mx-6 mb-6 overflow-x-auto px-6">
              <div
                role="tablist"
                className="flex min-w-max gap-1 rounded-lg border border-border bg-surface-2/40 p-1"
              >
                {TABS.map((t) => {
                  const n = t.id === "all" ? counts.all : (counts[t.id] ?? 0);
                  if (n === 0) return null;
                  return (
                    <TabButton
                      key={t.id}
                      active={tab === t.id}
                      label={t.label}
                      count={n}
                      onClick={() => setTab(t.id)}
                    />
                  );
                })}
                {hasDesign && (
                  <TabButton
                    active={tab === "design"}
                    label="Design"
                    onClick={() => setTab("design")}
                  />
                )}
              </div>
            </div>

            {tab === "design" ? (
              <DesignPanel
                palette={result.palette}
                typography={result.typography}
                tokens={result.tokens}
              />
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No {activeTabLabel.toLowerCase()} on this page.
                </p>
              </div>
            ) : tab === "api" || tab === "code" || tab === "data" ? (
              <NetworkTable assets={visible} onOpen={setExpanded} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {visible.slice(0, shown).map((a) => (
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

            {visible.length > shown && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + 96)}
                  className="rounded-lg border border-border px-5 py-2.5 text-[13.5px] font-medium text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
                >
                  Show {Math.min(96, visible.length - shown)} more
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {shown} of {visible.length}
                  </span>
                </button>
              </div>
            )}

            {tab !== "design" && visible.length > 0 && (
              <div className="sticky bottom-4 z-30 mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/90 px-5 py-3.5 backdrop-blur-xl">
                <span className="text-[13px] text-muted-foreground">
                  {visible.length} {activeTabLabel.toLowerCase()}
                  {visibleBytes > 0 && ` · ${formatBytes(visibleBytes)}`}
                </span>
                {progress && (
                  <div className="flex items-center gap-2.5">
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
                <div className="ml-auto flex gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                    className="h-9 rounded-lg border border-border px-4 text-[13px] font-medium transition-colors hover:border-accent disabled:opacity-40"
                  >
                    Choose files
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runDownload(visible, true)}
                    className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "Working" : `Download all ${visible.length}`}
                  </button>
                </div>
                {notice && (
                  <p className="w-full text-[12.5px] text-muted-foreground">{notice}</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <Features />
      <Audience />
      <Steps />
      <Faq />
      <Footer />

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
        <DetailDialog
          asset={expanded}
          onClose={() => setExpanded(null)}
          onDownload={() => runDownload([expanded], false)}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
        active
          ? "bg-surface text-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`font-mono text-[10px] tabular-nums ${
            active ? "text-accent" : "opacity-60"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Scripts, data and network calls read better as rows than as tiles. */
function NetworkTable({
  assets,
  onOpen,
}: {
  assets: Asset[];
  onOpen: (a: Asset) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="max-h-[560px] overflow-y-auto">
        {assets.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpen(a)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 ${
              i % 2 ? "bg-surface-2/30" : "bg-surface"
            }`}
          >
            {a.method && (
              <span className="w-11 shrink-0 font-mono text-[10px] font-semibold text-accent">
                {a.method}
              </span>
            )}
            <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-px font-mono text-[9.5px] font-semibold">
              {a.format}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px]">{a.displayName}</span>
            {a.preview && (
              <span className="hidden min-w-0 max-w-[38%] flex-1 truncate font-mono text-[11px] text-muted-foreground lg:block">
                {a.preview}
              </span>
            )}
            {a.status !== undefined && (
              <span
                className={`shrink-0 font-mono text-[10px] ${
                  a.status >= 400 ? "text-danger" : "text-muted-foreground"
                }`}
              >
                {a.status}
              </span>
            )}
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatBytes(a.bytes)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailDialog({
  asset,
  onClose,
  onDownload,
}: {
  asset: Asset;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${asset.displayName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-2xl overflow-auto rounded-xl border border-border bg-surface p-6 shadow-lift"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{asset.displayName}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {asset.url.slice(0, 140)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 font-mono text-[11px]"
          >
            ESC
          </button>
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

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onDownload}
            className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(asset.url)}
            className="h-9 rounded-lg border border-border px-4 text-[13px]"
          >
            Copy URL
          </button>
          <button
            type="button"
            onClick={() => openInNewTab(asset)}
            className="h-9 rounded-lg border border-border px-4 text-[13px]"
          >
            Open original
          </button>
        </div>
      </div>
    </div>
  );
}
