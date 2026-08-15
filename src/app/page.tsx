"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { Asset, AssetKind, ScanResult } from "@/lib/types";
import { AssetTile } from "@/components/AssetTile";
import { Picker } from "@/components/Picker";
import { Hero } from "@/components/Hero";
import { ScanProgress } from "@/components/ScanProgress";
import { DesignPanel } from "@/components/DesignPanel";
import { Faq, Footer } from "@/components/Sections";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toast, type ToastMessage, type ToastTone } from "@/components/Toast";
import { Countdown } from "@/components/Countdown";
import { Dissolve, DISSOLVE_MS } from "@/components/Dissolve";
import { SITE } from "@/lib/site";
import { humaniseScanError } from "@/lib/url-input";
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
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [expanded, setExpanded] = useState<Asset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shown, setShown] = useState(48);
  /** When this set of results stops being shown. Null before the first scan. */
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  /**
   * The depth the visible results were produced with.
   *
   * Distinct from `deep`, which is what the toggle currently says. They part
   * company the moment somebody flips it after a scan, and reading the toggle
   * would then label a set of quick results "deep".
   */
  const [ranDeep, setRanDeep] = useState(false);
  /** True while the tiles are dissolving, before the list is cleared. */
  const [expiring, setExpiring] = useState(false);
  /**
   * How hard the tiles are evaporating, 0 to 1, over the last thirty seconds.
   *
   * Nothing happens until then, and even then the tiles stay solid and
   * clickable — they only start shedding pixels, harder as the time goes. The
   * warning should be felt without anybody being hurried off a download they
   * are in the middle of.
   */
  const [shedding, setShedding] = useState(0);
  const [expiredHost, setExpiredHost] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const expiredRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  /** Lets a scan in flight be abandoned. A deep scan can run most of a minute. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setShedding(0);
      return;
    }
    const WINDOW_MS = 30_000;
    const tick = () => {
      const left = expiresAt - Date.now();
      // Quantised to tenths so this re-renders ten times over the window
      // rather than thirty, with the grid animating underneath it.
      const next =
        left > WINDOW_MS
          ? 0
          : Math.round(Math.min(1, Math.max(0, (WINDOW_MS - left) / WINDOW_MS)) * 10) / 10;
      setShedding((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  /**
   * Whether the action bar is drawn in.
   *
   * Not scroll direction — that flickers on every nudge and says nothing about
   * whether the bar is actually in the way. What matters is where the bar is:
   * stuck over the grid while you read it, or resting at the end of the list
   * once you have got there. A sentinel sitting just below it answers that
   * directly. Stuck means squeezed, arrived means full width.
   */
  const [barCompact, setBarCompact] = useState(false);
  const barEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barEndRef.current;
    if (!el) {
      setBarCompact(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setBarCompact(!entry.isIntersecting),
      // Extends the root below the fold, so the bar opens out as you arrive
      // rather than a beat after.
      { rootMargin: "0px 0px 40px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [result, tab]);

  const assets = useMemo(() => {
    if (!result) return [];
    return result.assets.map((a) => {
      const m = measured[a.id];
      return m && !a.width ? { ...a, width: m.w, height: m.h } : a;
    });
  }, [result, measured]);

  /**
   * The same picture at nine sizes is one picture. A CDN serving 236, 474 and
   * 736 pixel copies used to fill the grid with near-identical cards and bury
   * everything else, so only the largest of each family is listed; the rest are
   * offered as sizes inside its preview.
   */
  const deduped = useMemo(
    () => assets.filter((a) => a.isLargest !== false),
    [assets],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const a of deduped) {
      c[a.kind] = (c[a.kind] ?? 0) + 1;
      if (!a.noise) c.all += 1;
    }
    return c;
  }, [deduped]);

  const visible = useMemo(() => {
    if (tab === "design") return [];
    if (tab === "all") return deduped.filter((a) => !a.noise);
    return deduped.filter((a) => a.kind === tab);
  }, [deduped, tab]);

  /**
   * Where the open preview sits in the list behind it, so the arrows can move
   * along it without closing. Recomputed by id rather than held as an index,
   * because switching tab or letting results expire reshuffles the list.
   */
  const expandedIndex = expanded
    ? visible.findIndex((a) => a.id === expanded.id)
    : -1;

  const stepPreview = useCallback(
    (delta: number) => {
      setExpanded((current) => {
        if (!current) return current;
        const i = visible.findIndex((a) => a.id === current.id);
        return i < 0 ? current : (visible[i + delta] ?? current);
      });
    },
    [visible],
  );

  const visibleBytes = visible.reduce((n, a) => n + (a.bytes ?? 0), 0);
  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "Files";
  const hasDesign =
    (result?.palette?.length ?? 0) > 0 || (result?.typography?.length ?? 0) > 0;

  const runScan = useCallback(async (target: string, useDeep: boolean) => {
    // A second scan supersedes the first rather than racing it.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setError(null);
    setMeasured({});
    setToast(null);
    setTab("all");
    setShown(48);
    setExpiring(false);
    setExpiredHost(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target, deep: useDeep }),
        signal: controller.signal,
      });
      // Read as text first. A scan that runs past the platform's function
      // limit never reaches our code: the host answers with its own plain
      // error page, and calling res.json() on that threw the parser's own
      // message onto the screen — Unexpected token 'A', "An error o"…
      const body = await res.text();
      let data: (ScanResult & { error?: string }) | null = null;
      try {
        data = JSON.parse(body);
      } catch {
        /* not ours */
      }

      if (!data) {
        const tooLong =
          res.status === 504 ||
          res.status === 502 ||
          /timeout|timed out|took too long/i.test(body);
        throw new Error(
          tooLong
            ? "That page took too long to scan. Deep scans of very large sites can run past our limit — try again, or use quick."
            : "That scan did not complete. Try again in a moment.",
        );
      }
      if (!res.ok) throw new Error(humaniseScanError(data.error ?? "That scan did not work."));
      setResult(data as ScanResult);
      setRanDeep(useDeep);
      setShown(48);
      setExpiresAt(Date.now() + SITE.resultsMinutes * 60_000);
      // Results render inline, so bring them into view without a page change.
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
    } catch (e) {
      // Abandoning on purpose is not a failure, and saying "Something went
      // wrong" to someone who just pressed Cancel is a lie.
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(
        e instanceof Error
          ? humaniseScanError(e.message)
          : "Something went wrong.",
      );
      setResult(null);
    } finally {
      // A superseded scan must not clear the spinner belonging to the new one.
      if (abortRef.current === controller) {
        abortRef.current = null;
        setScanning(false);
      }
    }
  }, []);

  /** Give up on the running scan and hand the field back. */
  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, []);

  const onMeasure = useCallback((id: string, w: number, h: number) => {
    setMeasured((prev) => (prev[id] ? prev : { ...prev, [id]: { w, h } }));
  }, []);

  /**
   * The window closes. Scatter the tiles first, then drop the list.
   *
   * Deliberately two steps: clearing state immediately would unmount the tiles
   * and there would be nothing left to animate.
   */
  const beginExpiry = useCallback(() => {
    setExpiring(true);
    setExpanded(null);
    setPickerOpen(false);
    setTimeout(() => {
      setResult((r) => {
        if (r) {
          try {
            setExpiredHost(new URL(r.target).hostname.replace(/^www\./, ""));
          } catch {
            setExpiredHost(null);
          }
        }
        return null;
      });
      setExpiring(false);
      setExpiresAt(null);
      setMeasured({});
    }, DISSOLVE_MS);
  }, []);

  /**
   * Losing a long grid takes several screens of page with it, so whoever was
   * reading the bottom of it is left looking at blank space with no idea what
   * happened. Follow the content up to the message that explains it.
   */
  useEffect(() => {
    if (result || !expiredHost) return;
    expiredRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [result, expiredHost]);

  /** The id is a counter so the same sentence twice still reads as two events. */
  const say = useCallback((text: string, tone: ToastTone = "done") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  /**
   * A file's name is often its alt text, which can be a whole sentence. Cut it
   * at a word so the notice stays one readable line, and let the ellipsis end
   * the sentence rather than following a full stop with one.
   */
  const named = (a: Asset, verb: string) => {
    const raw = a.displayName.replace(/[\s.…]+$/, "");
    if (raw.length <= 44) return `${verb} ${raw}.`;
    const cut = raw.slice(0, 44);
    const space = cut.lastIndexOf(" ");
    return `${verb} ${(space > 20 ? cut.slice(0, space) : cut).trimEnd()}…`;
  };

  const hush = useCallback(() => setToast(null), []);

  async function runDownload(list: Asset[], asZip: boolean) {
    if (!list.length || busy) return;
    setBusy(true);
    setToast(null);

    if (list.length === 1) {
      const out = await downloadOne(list[0]);
      if (out.ok) {
        say(named(list[0], "Downloaded"));
      } else {
        openInNewTab(list[0]);
        say(
          "Its source refused the download, so it opened in a new tab instead.",
          "partial",
        );
      }
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

      if (out.failed.length === 0)
        say(
          asZip
            ? `Downloaded ${out.added} files as a zip.`
            : `Downloaded ${out.added} files.`,
        );
      else if (out.added === 0)
        say(`All ${out.failed.length} files were refused by the source.`, "failed");
      else
        say(
          `Downloaded ${out.added} of ${out.added + out.failed.length}. The rest were blocked by their source.`,
          "partial",
        );
    } catch {
      say("The download could not be completed.", "failed");
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
          <span className="ml-1.5">
            <ThemeToggle />
          </span>
          <a
            href="https://github.com/G-the-dev/pagehaul"
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-full bg-foreground px-5 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            GitHub
          </a>
        </nav>
      </header>

      <div ref={heroRef}>
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
          onCancel={cancelScan}
          scanning={scanning}
          error={error}
        />
      </div>

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
                <span>{ranDeep ? "deep" : "quick"}</span>
                {expiresAt && !expiring && (
                  <>
                    <span className="h-3 w-px bg-border" />
                    <Countdown expiresAt={expiresAt} onExpire={beginExpiry} />
                  </>
                )}
              </div>
            </div>

            {result.notes.length > 0 && (
              <div className="mb-6 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px] leading-relaxed text-warn">
                {result.notes.join(" ")}
              </div>
            )}

            {!ranDeep && counts.all < 10 && (
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
                {visible.slice(0, shown).map((a, i) => (
                  <Dissolve
                    key={a.id}
                    active={expiring}
                    shedding={shedding}
                    src={a.thumbUrl ?? a.poster ?? a.url}
                    seed={i * 31}
                  >
                    <AssetTile
                      asset={a}
                      selected={false}
                      selectable={false}
                      onToggle={() => setExpanded(a)}
                      onMeasure={onMeasure}
                    />
                  </Dissolve>
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
              // Full width while you are heading down the grid toward the
              // buttons, and drawn in to a pill while you are scrolling back up
              // through the files, where it is only in the way.
              /*
                 Plain CSS transition rather than framer's layout animation.
                 That one measures every child on every frame to interpolate
                 positions, which on a bar of buttons over a grid of hundreds of
                 tiles is exactly the stutter it was producing. One element
                 easing its own max-width is something the compositor can do
                 without asking the layout engine anything about the rest.
              */
              <div
                className="sticky bottom-4 z-30 mx-auto mt-8 w-full transition-[max-width] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ maxWidth: barCompact ? 560 : 1400 }}
              >
              <div
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/90 backdrop-blur-xl transition-[padding] duration-300 ${
                  barCompact ? "px-4 py-2.5" : "px-5 py-3.5"
                }`}
              >
                <span className="text-[13px] text-muted-foreground">
                  {visible.length} {activeTabLabel.toLowerCase()}
                  {visibleBytes > 0 && ` · ${formatBytes(visibleBytes)}`}
                  {/* Said where the download buttons are, because that is the
                      moment it matters: take what you want now. */}
                  {!barCompact && (
                    <span className="ml-2 hidden text-muted-foreground/70 sm:inline">
                      · clears after {SITE.resultsMinutes} min
                    </span>
                  )}
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
                    {barCompact ? "Choose" : "Choose files"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runDownload(visible, true)}
                    className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    {busy
                      ? "Working"
                      : barCompact
                        ? `Download ${visible.length}`
                        : `Download all ${visible.length}`}
                  </button>
                </div>
              </div>
              </div>
            )}

            {/* Marks the end of the list. While this is off screen the bar is
                stuck over the grid and squeezes; once it scrolls into view the
                bar has arrived and opens back out. */}
            {tab !== "design" && visible.length > 0 && (
              <div ref={barEndRef} aria-hidden className="h-px w-full" />
            )}
          </div>
        </section>
      )}

      {/* Where the results were. Said plainly, with the way back in reach —
          an empty page after a countdown reads as something having gone wrong. */}
      {!result && expiredHost && (
        <section ref={expiredRef as React.RefObject<HTMLElement>} className="mx-auto max-w-[1400px] px-6 py-14">
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <p className="text-[16px] font-semibold">
              Those results have cleared.
            </p>
            <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              A scan is held for {SITE.resultsMinutes} minutes and then dropped.
              Nothing was stored on our side to begin with, so scanning again
              costs you only the wait.
            </p>
            <button
              type="button"
              // Progress is drawn in the hero, and this button is several
              // screens below it. Starting a scan from here without moving
              // meant the card vanished and left you watching nothing happen.
              onClick={() => {
                setUrl(expiredHost);
                heroRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                runScan(expiredHost, deep);
              }}
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-[13.5px] font-semibold text-accent-fg transition-all hover:brightness-110"
            >
              Scan {expiredHost} again
            </button>
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
          position={expandedIndex >= 0 ? expandedIndex + 1 : undefined}
          total={expandedIndex >= 0 ? visible.length : undefined}
          onPrev={expandedIndex > 0 ? () => stepPreview(-1) : undefined}
          onNext={
            expandedIndex >= 0 && expandedIndex < visible.length - 1
              ? () => stepPreview(1)
              : undefined
          }
        />
      )}

      <Toast message={toast} onDismiss={hush} />
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
      // The selected tab used to be #171717 on a #151515 track, which is a
      // difference of two values and reads as nothing at all. It now lifts to
      // the next surface up with a lit top edge, so selection is legible
      // without colour, in either theme.
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
        active
          ? "bg-surface-3 text-foreground shadow-lift ring-1 ring-inset ring-[rgb(var(--raise)/0.14)]"
          : "text-muted-foreground hover:bg-[rgb(var(--raise)/0.05)] hover:text-foreground"
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

/** Shown on a button and bound to the key. One source, so they cannot drift. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    // Border and ink both inherit the button's own colour, so one chip reads
    // correctly on the filled button and the outlined ones alike.
    <kbd className="ml-1.5 rounded border border-current px-1 font-mono text-[9.5px] leading-[1.4] opacity-45">
      {children}
    </kbd>
  );
}

function DetailDialog({
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
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {asset.url.slice(0, 140)}
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
