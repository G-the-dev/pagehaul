"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Asset, AssetKind, ScanResult } from "@/lib/types";
import { TileGrid } from "@/components/TileGrid";
import { Hero } from "@/components/Hero";
import { ScanProgress } from "@/components/ScanProgress";
import { Faq, Footer, HatchBand } from "@/components/Sections";
import { PricingSection } from "@/components/Paywall";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Toast, type ToastMessage, type ToastTone } from "@/components/Toast";
import { Countdown } from "@/components/Countdown";
import { SITE } from "@/lib/site";
import { humaniseScanError } from "@/lib/url-input";
import { mergeScans } from "@/lib/merge";
import { addRecent, getRecent, removeRecent, type Recent } from "@/lib/recent";
import { Features, Audience, Steps } from "@/components/Features";
import { Mark } from "@/components/Mark";
import { MobileHaul } from "@/components/MobileHaul";
import dynamic from "next/dynamic";
import { track } from "@/lib/analytics";
import { startFaviconSpin, stopFaviconSpin } from "@/lib/scan-favicon";
import { modelRenderable, preloadModelViewer } from "@/components/ModelPreview";
import { ensureModelPoster } from "@/lib/model-thumbs";
import { thumbnailUrl } from "@/lib/variants";
import {
  deepAllowed,
  deepScansLeft,
  isPaid,
  licenseEmail,
  licensePlan,
  licenseToken,
  storeLicense,
  packScansLeft,
  planExpiry,
  tokenStartsAt,
  recordDeepScan,
  recordPackScan,
  LOCKED_KINDS,
} from "@/lib/plan";

/** The host alone — what was scanned, never the whole address. */
function hostOf(raw: string): string | undefined {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname
      .replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/*
  Fetched on use, not on arrival.

  None of these can be needed by somebody who has just opened the page: the
  picker waits for "Choose files", the design panel for the Design tab, and the
  dissolve for a countdown that has seven minutes to run. Loading them up front
  put the whole scanner in the bundle served to every visitor, including the
  ones only reading the legal pages.
*/
const Picker = dynamic(() => import("@/components/Picker").then((m) => m.Picker), {
  ssr: false,
});
const DesignPanel = dynamic(
  () => import("@/components/DesignPanel").then((m) => m.DesignPanel),
  { ssr: false },
);
const DetailDialog = dynamic(
  () => import("@/components/DetailDialog").then((m) => m.DetailDialog),
  { ssr: false },
);
const Paywall = dynamic(
  () => import("@/components/Paywall").then((m) => m.Paywall),
  { ssr: false },
);
const PixelDissolve = dynamic(
  () => import("@/components/PixelDissolve").then((m) => m.PixelDissolve),
  { ssr: false },
);
import {
  downloadAsZip,
  downloadEachSeparately,
  downloadOne,
  formatBytes,
  openInNewTab,
  type ZipProgress,
} from "@/lib/download";

type Tab = "all" | AssetKind | "design";

/** Matches the document title in layout.tsx, restored after scan updates. */
const BASE_TITLE = "pagehaul, every asset on any page";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "screenshot", label: "Screenshots" },
  { id: "svg", label: "Icons" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "font", label: "Fonts" },
  { id: "model", label: "3D" },
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
  /**
   * Files whose thumbnail loaded and turned out to be one flat colour — a
   * placeholder JPEG, an empty vector. They reclassify as noise the moment
   * the pixels give them away, the same way a measured 1x1 pixel does.
   */
  const [blankIds, setBlankIds] = useState<Set<string>>(new Set());
  const onBlank = useCallback((id: string) => {
    setBlankIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [expanded, setExpanded] = useState<Asset | null>(null);
  /**
   * The plan, mirrored into state after mount. Read from localStorage, so it
   * must not take part in the server render; until the effect runs the page
   * draws the neutral version (no counters, nothing locked-looking).
   */
  const [paid, setPaid] = useState(false);
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  const [paywall, setPaywall] = useState<null | "limit" | "design" | "locked">(null);
  /** "Pro" or "Pack · n left", shown in the nav so a paid person can tell. */
  const [planLabel, setPlanLabel] = useState<string | null>(null);
  const refreshPlan = useCallback(() => {
    setPaid(isPaid());
    setFreeLeft(deepScansLeft());
    const plan = licensePlan();
    setPlanLabel(
      plan === "pro"
        ? "Pro"
        : plan === "pack"
          ? `Pack · ${packScansLeft()} left`
          : null,
    );
  }, []);
  useEffect(() => {
    refreshPlan();
    // The landing pricing section unlocks plans without a callback path to
    // this component; it announces instead.
    window.addEventListener("ph-plan-changed", refreshPlan);
    // The unlock link from the receipt email: opening it on any device
    // installs the purchase there. Nobody has to know what a license is;
    // the link is the purchase.
    try {
      const exp = planExpiry();
      if (
        licensePlan() === "pro" &&
        exp !== null &&
        exp - Date.now() < 7 * 24 * 60 * 60_000 &&
        !window.localStorage.getItem("ph-renewal-sent")
      ) {
        window.localStorage.setItem("ph-renewal-sent", "1");
        fetch("/api/upi/renewal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: licenseToken() }),
        }).catch(() => {});
      }
    } catch {
      /* storage blocked; the nudge is a nicety */
    }
    const m = window.location.hash.match(/^#restore=(.+)$/);
    if (m) {
      const token = decodeURIComponent(m[1]);
      if (token.startsWith("v1.")) {
        storeLicense(token);
        refreshPlan();
        const nbf = tokenStartsAt(token);
        setToast({
          id: Date.now(),
          text:
            nbf && nbf > Date.now()
              ? `Queued. Your purchase activates ${new Date(nbf).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`
              : "Your plan is unlocked on this device.",
          tone: "done",
        });
        history.replaceState(null, "", window.location.pathname);
      }
    }
    return () => window.removeEventListener("ph-plan-changed", refreshPlan);
  }, [refreshPlan]);
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
  const [expiredHost, setExpiredHost] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const expiredRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  /** Lets a scan in flight be abandoned. A deep scan can run most of a minute. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Everything this tab has ever found per site, so a rescan can only grow.
   * A live page is a moving target and two honest scans can disagree by a
   * few files; people rightly read "fewer than last time" as broken. Each
   * fresh result is unioned with the tab's last known set for that host —
   * the fresh scan wins conflicts, the prior only contributes what the
   * fresh pass happened to miss. Screenshots stay per-scan.
   */
  const lastByHostRef = useRef<Map<string, ScanResult>>(new Map());

  // The addresses scanned before, from this browser's own storage. Loaded after
  // mount so the server render (which cannot see localStorage) stays the
  // examples and hydration matches.
  const [recent, setRecent] = useState<Recent[]>([]);
  useEffect(() => setRecent(getRecent()), []);

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
  /**
   * True for the moment the bar is changing width.
   *
   * The frosted look is worth having, but blurring a strip this wide means
   * recompositing everything behind it on every frame — over a grid of
   * photographs that is exactly what made the resize stutter. So the blur is
   * on whenever the bar is sitting still, which is nearly always, and off for
   * the four hundred milliseconds it is actually moving.
   */
  const [barResizing, setBarResizing] = useState(false);

  /**
   * True once the page has been scrolled meaningfully. The phone's banner
   * makes its case at the top and then gets out of the way — while reading,
   * only the nav deserves the pixels.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setBarResizing(true);
    const t = setTimeout(() => setBarResizing(false), 460);
    return () => clearTimeout(t);
  }, [barCompact]);

  // Marks the document as scrolling so backdrop blur can stand down for the
  // duration (see globals.css). A short idle timer clears it once you stop.
  useEffect(() => {
    const root = document.documentElement;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      root.classList.add("is-scrolling");
      clearTimeout(idle);
      idle = setTimeout(() => root.classList.remove("is-scrolling"), 140);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idle);
      root.classList.remove("is-scrolling");
    };
  }, []);

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
      const blank = blankIds.has(a.id);
      if ((!m || a.width) && !blank) return a;
      // A file the server could not size can still measure 1x1 the moment
      // its tile loads — a tracking pixel, drawn as a blank card until now.
      // It reclassifies itself as noise as soon as it is known; a thumbnail
      // that loads as one flat colour does the same.
      const noise =
        a.noise || blank || (m && !a.width && m.w <= 2 && m.h <= 2) || undefined;
      return {
        ...a,
        width: a.width ?? m?.w,
        height: a.height ?? m?.h,
        noise,
      };
    });
  }, [result, measured, blankIds]);

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
        let i = visible.findIndex((a) => a.id === current.id);
        if (i < 0) return current;
        // Arrow past locked 3D rather than into it — the lock lives on the
        // tile, and the preview walk should not be a side door through it.
        do {
          i += delta;
        } while (
          visible[i] &&
          (LOCKED_KINDS as readonly string[]).includes(visible[i].kind) &&
          !isPaid()
        );
        return visible[i] ?? current;
      });
    },
    [visible],
  );

  /** Opens a preview — except locked 3D, which opens the pricing dialog. */
  const openAsset = useCallback((a: Asset) => {
    if ((LOCKED_KINDS as readonly string[]).includes(a.kind) && !isPaid()) {
      setPaywall("locked");
      return;
    }
    setExpanded(a);
  }, []);

  // The arrows walk the list, so the files either side of the open one should
  // already be on their way before the key is pressed. Fetch and pre-decode
  // both neighbours; stepping then paints from cache instead of starting a
  // download at the moment the person asks to see it.
  useEffect(() => {
    if (!expanded || expandedIndex < 0) return;
    for (const n of [visible[expandedIndex + 1], visible[expandedIndex - 1]]) {
      if (!n) continue;
      if (n.kind !== "image" && n.kind !== "svg" && n.kind !== "screenshot") continue;
      const img = new window.Image();
      img.src = n.url;
      img.decode?.().catch(() => {
        /* a neighbour that fails to preload just loads on arrival */
      });
    }
  }, [expanded, expandedIndex, visible]);

  const visibleBytes = visible.reduce((n, a) => n + (a.bytes ?? 0), 0);
  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "Files";
  const hasDesign =
    (result?.palette?.length ?? 0) > 0 ||
    (result?.typography?.length ?? 0) > 0 ||
    (result?.tokens?.length ?? 0) > 0;

  const runScan = useCallback(async (target: string, useDeep: boolean) => {
    // The allowance is checked before anything is torn down, so hitting the
    // limit leaves whatever results are on screen exactly as they were.
    if (useDeep && !isPaid() && !deepAllowed()) {
      setPaywall("limit");
      return;
    }
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
    // A dissolve queued for the old results must not fire on the new ones.
    expiryWaitRef.current?.();
    expiryWaitRef.current = null;
    setBlankIds(new Set());
    // The tab's own title reports progress, so someone who does switch away
    // has a reason to come back.
    document.title = `scanning ${hostOf(target) ?? "the page"}… · pagehaul`;

    const request = async (deep: boolean): Promise<ScanResult> => {
      const lic = licenseToken();
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(lic ? { "x-ph-license": lic } : {}),
        },
        body: JSON.stringify({ url: target, deep }),
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
            ? "That page took too long to scan. Deep scans of very large sites can run past our limit. Try again, or use quick."
            : "That scan did not complete. Try again in a moment.",
        );
      }
      // The server's own count says the free allowance is spent — perhaps in
      // another browser, perhaps after cleared storage. Not an error to
      // apologise for; the pricing dialog is the answer.
      if (res.status === 402) throw new Error("__scan_limit__");
      if (!res.ok) throw new Error(humaniseScanError(data.error ?? "That scan did not work."));
      return data as ScanResult;
    };

    try {
      const fresh = await request(useDeep);
      // A rescan may only grow — union with what this tab already knows.
      const hostKey = hostOf(target) ?? target;
      const prior = lastByHostRef.current.get(hostKey);
      const data = prior ? mergeScans(fresh, prior) : fresh;
      lastByHostRef.current.set(hostKey, {
        ...data,
        assets: data.assets.filter((a) => a.kind !== "screenshot"),
        notes: [],
      });
      if (lastByHostRef.current.size > 4) {
        const oldest = lastByHostRef.current.keys().next().value;
        if (oldest !== undefined) lastByHostRef.current.delete(oldest);
      }
      // The full address as well as the host: the privacy policy already
      // discloses recording submitted addresses, and "what do people scan"
      // is the first product question analytics exists to answer. The notes
      // ride along so a thin result explains itself in the event stream too.
      track("scan", {
        host: hostOf(target),
        url: target,
        deep: useDeep,
        assets: data.assets.length,
        ms: fresh.ms,
        partial: !!fresh.partial,
        notes: fresh.notes.length ? fresh.notes : undefined,
      });
      // Successful deep scans count against whichever budget is paying for
      // them: the free allowance, or a pack's five. Recording only on
      // success means a scan that failed cost nothing.
      if (useDeep) {
        if (licensePlan() === "pack" && isPaid()) {
          recordPackScan();
          refreshPlan();
          // The pricing cards keep their own count; tell them a scan left.
          window.dispatchEvent(new Event("ph-plan-changed"));
          // Down to the last scan: ask the server to send the refill nudge,
          // once per pack. The token carries the address and the proof.
          try {
            if (
              packScansLeft() === 1 &&
              !window.localStorage.getItem("ph-lowpack-sent")
            ) {
              window.localStorage.setItem("ph-lowpack-sent", "1");
              fetch("/api/upi/lowpack", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token: licenseToken() }),
              }).catch(() => {});
            }
          } catch {
            /* storage blocked; the nudge is a nicety */
          }
        } else if (!isPaid()) {
          recordDeepScan();
          setFreeLeft(deepScansLeft());
        }
      }
      setResult(data);
      setRanDeep(useDeep);
      setShown(48);
      setExpiresAt(Date.now() + SITE.resultsMinutes * 60_000);
      setRecent(addRecent(target));
      // Results render inline, so bring them into view without a page change.
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        80,
      );
      // Call the wanderers home; everyone else keeps the ordinary title.
      document.title = document.hidden ? "✓ scan ready · pagehaul" : BASE_TITLE;
    } catch (e) {
      // Abandoning on purpose is not a failure, and saying "Something went
      // wrong" to someone who just pressed Cancel is a lie.
      if (e instanceof DOMException && e.name === "AbortError") {
        document.title = BASE_TITLE;
        return;
      }
      if (e instanceof Error && e.message === "__scan_limit__") {
        document.title = BASE_TITLE;
        setPaywall("limit");
        return;
      }
      const message =
        e instanceof Error ? humaniseScanError(e.message) : "Something went wrong.";
      track("scan_failed", {
        host: hostOf(target),
        url: target,
        deep: useDeep,
        error: message,
      });
      document.title = BASE_TITLE;
      setError(message);
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
    document.title = BASE_TITLE;
  }, []);

  // If the results hold models, start rendering their posters now, while
  // the person is still reading the grid. The queue does one at a time —
  // WebGL contexts are the scarce thing — so by the time the 3D tab is
  // opened, the early ones are pictures and the rest are visibly on their
  // way.
  useEffect(() => {
    if (!result) return;
    const models = result.assets.filter(
      (a) => a.kind === "model" && modelRenderable(a.url),
    );
    if (models.length === 0) return;
    void preloadModelViewer();
    for (const a of models.slice(0, 12)) {
      void ensureModelPoster(a.id, a.url);
    }
  }, [result]);

  // Warm the tabs nobody has opened yet. The visible grid loads eagerly on
  // its own; this quietly fetches the thumbnails and video posters of the
  // rest during idle time, capped, so switching tabs meets pictures instead
  // of a wall of grey. Low priority — a scan the person is actively reading
  // always outranks a tab they might visit.
  useEffect(() => {
    if (!result) return;
    const idle =
      "requestIdleCallback" in window
        ? (cb: () => void) =>
            (window as Window & { requestIdleCallback: (cb: () => void) => number })
              .requestIdleCallback(cb)
        : (cb: () => void) => window.setTimeout(cb, 1200);
    idle(() => {
      let budget = 60;
      for (const a of result.assets) {
        if (budget <= 0) break;
        if (a.noise || a.inline || a.isLargest === false) continue;
        let src: string | null = null;
        if (a.kind === "image") {
          // The same address the tile itself uses, so this warms the cache
          // the grid will actually read from.
          src = a.thumbUrl ?? thumbnailUrl(a.url) ?? a.url;
        } else if (a.kind === "video" && !a.poster) {
          src = `/api/poster?url=${encodeURIComponent(a.url)}`;
        } else {
          continue;
        }
        const img = new window.Image();
        img.fetchPriority = "low";
        img.src = src;
        budget--;
      }
    });
  }, [result]);

  // While a scan runs, the favicon's tiles slide clockwise around the gap —
  // the tab itself works, visibly, even from another tab. The mark returns
  // whole the moment the scan settles, however it settles.
  useEffect(() => {
    if (!scanning) return;
    startFaviconSpin();
    return () => stopFaviconSpin();
  }, [scanning]);

  // Whoever left mid-scan and was called back by the "✓ scan ready" title
  // gets the ordinary title again the moment they arrive.
  useEffect(() => {
    const restore = () => {
      if (document.visibilityState === "visible" && document.title.startsWith("✓")) {
        document.title = BASE_TITLE;
      }
    };
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, []);

  const onMeasure = useCallback((id: string, w: number, h: number) => {
    setMeasured((prev) => (prev[id] ? prev : { ...prev, [id]: { w, h } }));
  }, []);

  /** Cancels a dissolve waiting for the person to come back, if one is. */
  const expiryWaitRef = useRef<(() => void) | null>(null);

  /**
   * The window closes. Scatter the tiles first, then drop the list.
   *
   * Deliberately two steps: clearing state immediately would unmount the tiles
   * and there would be nothing left to animate.
   *
   * And only ever in front of the person. A dissolve that plays in a hidden
   * tab explains nothing — they come back to an empty page and a message
   * about results they never saw leave. If the clock runs out while the tab
   * is hidden, the tiles hold, and the scatter plays the moment they return:
   * the disappearance itself is the explanation.
   */
  const beginExpiry = useCallback(() => {
    const scatter = () => {
      // The dissolve draws only the tiles on screen, and dust nobody sees
      // explains nothing — so first put the grid in front of the person:
      // back to the tab that has tiles, scrolled into view, then let go.
      setTab("all");
      setExpanded(null);
      setPickerOpen(false);
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => setExpiring(true), 700);
    };
    if (!document.hidden) {
      scatter();
      return;
    }
    const onBack = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onBack);
      expiryWaitRef.current = null;
      // A beat for the tab to paint, so the person sees what they had
      // before they watch it go.
      setTimeout(scatter, 900);
    };
    expiryWaitRef.current = () =>
      document.removeEventListener("visibilitychange", onBack);
    document.addEventListener("visibilitychange", onBack);
  }, []);

  /** Called by the animation when the last particle has gone. */
  const finishExpiry = useCallback(() => {
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
    // Audio, screenshots and 3D belong to Pro. An all-locked haul asks the
    // question directly; a mixed one goes ahead without them and says so,
    // because refusing a hundred images over two locked files would punish
    // the wrong files.
    let heldBack = 0;
    if (!isPaid()) {
      const kept = list.filter(
        (a) => !(LOCKED_KINDS as readonly string[]).includes(a.kind),
      );
      if (kept.length === 0 && list.length > 0) {
        setPaywall("locked");
        return;
      }
      heldBack = list.length - kept.length;
      list = kept;
    }
    if (!list.length || busy) return;
    setBusy(true);
    setToast(null);
    if (heldBack > 0) {
      say("Audio, screenshots and 3D are part of Pro, so they stayed behind.", "partial");
    }

    if (list.length === 1) {
      const out = await downloadOne(list[0]);
      // The outcome, not the attempt: "downloads that failed" is the number
      // that says whether the product works, and only the result knows it.
      track("download", {
        files: 1,
        zip: false,
        kind: list[0].kind,
        format: list[0].format,
        added: out.ok ? 1 : 0,
        failed: out.ok ? 0 : 1,
      });
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

      track("download", {
        files: list.length,
        zip: asZip,
        kind: tab,
        added: out.added,
        failed: out.failed.length,
      });

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
      track("download", {
        files: list.length,
        zip: asZip,
        kind: tab,
        added: 0,
        failed: list.length,
      });
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
      {/* Phones get the honest recommendation, loudly, and nobody else sees
          it: the desktop version is where previews and per-file browsing
          live, and pretending otherwise helps no one. Tablets cope fine. */}
      <div
        className={`fixed inset-x-0 top-0 z-[60] transition-transform duration-300 sm:hidden ${
          scrolled ? "-translate-y-full" : ""
        }`}
      >
        <p className="bg-accent px-4 py-2.5 text-center text-[13.5px] font-semibold leading-snug text-accent-fg">
          You&apos;re on the pocket version. Open pagehaul on a desktop for
          full previews and every asset.
        </p>
      </div>

      <header
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 transition-[padding] duration-300 sm:pt-6 ${
          scrolled ? "pt-3" : "pt-16"
        }`}
      >
        {/* Full width on the phone — brand left, controls right — and the
            centred floating pill everywhere else. */}
        <nav className="keep-blur pointer-events-auto flex w-full items-center gap-1.5 rounded-full border border-border bg-surface/70 py-2 pl-4 pr-1.5 backdrop-blur-md sm:w-auto sm:pl-6 sm:pr-2">
          <a
            href="#top"
            className="flex items-center gap-1.5 pr-4 text-[16px] font-semibold tracking-tight sm:gap-2"
          >
            <Mark size={15} />
            pagehaul
          </a>
          {/* The section links are a desktop luxury. On a phone they wrapped
              the pill to three lines and pushed the brand and GitHub off both
              edges; the sections are one thumb-scroll away anyway. */}
          <span className="mr-1.5 hidden h-4 w-px bg-border sm:block" />
          {[
            ["What you get", "#what"],
            ["How", "#how"],
            ["Pricing", "#pricing"],
            ["FAQ", "#faq"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="hidden rounded-full px-3.5 py-2 text-[14px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground sm:block"
            >
              {label}
            </a>
          ))}
          <span className="ml-auto flex items-center gap-2.5 sm:ml-1.5">
            {planLabel && (
              <span
                title={licenseEmail() ?? undefined}
                className="rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 font-mono text-[11px] font-semibold"
              >
                {planLabel}
              </span>
            )}
            <ThemeToggle />
            {/* The nav's one loud button goes to the feedback form while the
                platform is finding its feet, and a tester's report is worth more
                than a star. The repo keeps its link in the footer. */}
            <a
              href="/contact"
              className="rounded-full bg-foreground px-5 py-2.5 text-[14.5px] font-semibold text-background transition-opacity hover:opacity-90"
            >
              Feedback
            </a>
          </span>
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
          recent={recent}
          onRemoveRecent={(url) => setRecent(removeRecent(url))}
          scanning={scanning}
          error={error}
          freeDeepLeft={paid ? null : freeLeft}
        />
      </div>

      {/* Results live on the same page, directly under the input, so a new
          link is always one scroll away. */}
      {result && (
        // scroll-margin, so arriving here by scrollIntoView lands the header
        // row clear of the floating nav (and, on a phone, the banner too)
        // instead of sliding the first line of results underneath them.
        <section ref={resultsRef} className="relative scroll-mt-36 sm:scroll-mt-24">
          {/* Wider on a genuinely wide screen — but never wall to wall. The
              cap alone was not enough: at window widths near the cap, the
              padding was the only inset left, and the grid sat against the
              glass. The padding grows with the screen so the margin is real
              at every width. */}
          <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-12 2xl:max-w-[1680px] 2xl:px-16">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[1.75rem] font-medium tracking-tight">
                {counts.all}{" "}
                <span className="text-muted-foreground">
                  file{counts.all === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="flex items-center gap-3 font-mono text-[12px] text-muted-foreground">
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
              <div className="mb-6 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-[14.5px] leading-relaxed text-warn">
                {result.notes.join(" ")}
              </div>
            )}

            {!ranDeep && counts.all < 10 && (
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3">
                <p className="text-[14.5px]">
                  This page loads most of its content with JavaScript.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeep(true);
                    runScan(result.target, true);
                  }}
                  className="ml-auto rounded-md bg-accent px-3 py-1.5 text-[13.5px] font-semibold text-accent-fg"
                >
                  Run deep scan
                </button>
              </div>
            )}

            {/* On a phone the grid of hundreds of tiles is homework, not
                help. The phone gets the decision instead: tick the kinds you
                want, take the zip. Everything from the tabs to the action
                bar is the desktop's. */}
            <div className="sm:hidden">
              <MobileHaul
                assets={deduped}
                busy={busy}
                progress={progress}
                onDownload={(chosen) => runDownload(chosen, true)}
              />
            </div>

            <div className="hidden sm:block">
            {/* tabs */}
            <div className="-mx-6 mb-6 overflow-x-auto px-6">
              <div
                role="tablist"
                className="flex min-w-max gap-2 rounded-lg border border-border bg-surface-2/40 p-1"
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
                {/* Design is offered for every page. When a deep scan already
                    read it, the tab holds the palette, type and tokens; on a
                    quick scan it holds a one-tap invitation to go and get them.
                    Only a deep scan that genuinely found nothing hides it. */}
                {(hasDesign || !ranDeep) && (
                  <TabButton
                    active={tab === "design"}
                    label="Design"
                    onClick={() => setTab("design")}
                  />
                )}
              </div>
            </div>

            {tab === "design" ? (
              hasDesign ? (
                paid ? (
                  <DesignPanel
                    palette={result.palette}
                    typography={result.typography}
                    tokens={result.tokens}
                    host={host}
                  />
                ) : (
                  // The real panel, behind glass. Showing the shape of what
                  // was extracted sells it better than a description could;
                  // the server-side entitlement is on scans, and the browser
                  // owns this render either way.
                  <div className="relative overflow-hidden rounded-xl">
                    <div className="pointer-events-none select-none blur-lg" aria-hidden>
                      <DesignPanel
                        palette={result.palette}
                        typography={result.typography}
                        tokens={result.tokens}
                        host={host}
                      />
                    </div>
                    <div className="absolute inset-0 grid place-items-center bg-background/40">
                      <div className="max-w-sm rounded-xl border border-border bg-background p-6 text-center shadow-soft">
                        <p className="text-[15px] font-semibold">
                          The design system is part of Pro
                        </p>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                          Palette, typography and tokens, read from the page as
                          a browser paints it.
                        </p>
                        <button
                          type="button"
                          onClick={() => setPaywall("design")}
                          className="mt-4 rounded-md bg-accent px-4 py-2 text-[14px] font-semibold text-accent-fg transition-opacity hover:opacity-90"
                        >
                          Unlock with Pro
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                // A quick scan reads the markup, not the painted page, so it has
                // no colours or type to show yet. Rather than a dead end, the
                // tab explains where the design system comes from and fetches it.
                <div className="rounded-xl border border-dashed border-border py-16 text-center">
                  <p className="text-[15px] text-foreground">
                    The design system comes from a deep scan.
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
                    Colours, fonts and design tokens are read from the page as a
                    browser paints it; a quick scan only sees the markup.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeep(true);
                      setTab("all");
                      runScan(result.target, true);
                    }}
                    className="mt-5 rounded-md bg-accent px-4 py-2 text-[14px] font-semibold text-accent-fg transition-opacity hover:opacity-90"
                  >
                    Extract the design system
                  </button>
                </div>
              )
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-16 text-center">
                <p className="text-[15px] text-muted-foreground">
                  No {activeTabLabel.toLowerCase()} on this page.
                </p>
              </div>
            ) : tab === "api" || tab === "code" || tab === "data" ? (
              <NetworkTable assets={visible} onOpen={openAsset} />
            ) : (
              <>
                {(LOCKED_KINDS as readonly string[]).includes(tab) && !paid && (
                  <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3">
                    <p className="text-[14.5px]">
                      Previews and downloads here are part of Pro.
                    </p>
                    <button
                      type="button"
                      onClick={() => setPaywall("locked")}
                      className="ml-auto rounded-md bg-accent px-3 py-1.5 text-[13.5px] font-semibold text-accent-fg"
                    >
                      Unlock with Pro
                    </button>
                  </div>
                )}
                <TileGrid
                  assets={visible.slice(0, shown)}
                  onOpen={openAsset}
                  onMeasure={onMeasure}
                  onBlank={onBlank}
                />
              </>
            )}

            {visible.length > shown && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShown((n) => n + 96)}
                  className="rounded-lg border border-border px-5 py-2.5 text-[14.5px] font-medium text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
                >
                  Show {Math.min(96, visible.length - shown)} more
                  <span className="ml-2 font-mono text-[12px] text-muted-foreground">
                    {shown} of {visible.length}
                  </span>
                </button>
              </div>
            )}

            {/* Marks the end of the list — deliberately ABOVE the bar. The bar
                changes height as it squeezes, and a sentinel below it moves
                with that change: squeeze, sentinel rises into view, open out,
                sentinel pushed back under, squeeze again — an oscillation you
                could watch. The end of the grid holds still whatever the bar
                does, so observing it cannot feed back. */}
            {tab !== "design" && visible.length > 0 && (
              <div ref={barEndRef} aria-hidden className="h-px w-full" />
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
                // The open width only needs to exceed the container, which
                // does the real capping — so one number serves 1400 and 1800.
                style={{ maxWidth: barCompact ? 560 : 1800 }}
              >
              <div
                className={`flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface/85 transition-[padding] duration-300 ${
                  barCompact ? "px-4 py-2.5" : "px-5 py-3.5"
                } ${barResizing ? "" : "backdrop-blur-xl"}`}
              >
                <span className="text-[14px] text-muted-foreground">
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
                    <span className="font-mono text-[12px] text-muted-foreground">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
                <div className="ml-auto flex gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                    className="h-9 rounded-lg border border-border px-4 text-[14px] font-medium transition-colors hover:border-accent disabled:opacity-40"
                  >
                    {barCompact ? "Choose" : "Choose files"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runDownload(visible, true)}
                    className="h-9 rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
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
            </div>
          </div>
        </section>
      )}

      {/* Where the results were. Said plainly, with the way back in reach —
          an empty page after a countdown reads as something having gone wrong. */}
      {!result && expiredHost && (
        <section ref={expiredRef as React.RefObject<HTMLElement>} className="mx-auto max-w-[1400px] px-6 py-14">
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
            <p className="text-[17px] font-semibold">
              Those results have cleared.
            </p>
            <p className="mx-auto mt-2.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
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
              className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-accent-fg transition-all hover:brightness-110"
            >
              Scan {expiredHost} again
            </button>
          </div>
        </section>
      )}

      <Features />
      <HatchBand />
      <Audience />
      <HatchBand />
      <Steps />
      <HatchBand />
      <PricingSection />
      <HatchBand />
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
          onDownload={(url) =>
            runDownload(
              [url === expanded.url ? expanded : { ...expanded, url }],
              false,
            )
          }
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

      {paywall && (
        <Paywall
          reason={paywall}
          onClose={() => setPaywall(null)}
          onUnlocked={() => {
            refreshPlan();
            setPaywall(null);
            say("Unlocked. Everything is yours now.");
          }}
        />
      )}

      <PixelDissolve active={expiring} onDone={finishExpiry} />

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
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-1.5 text-[14px] font-medium transition-all ${
        active
          ? "bg-surface-3 text-foreground shadow-lift ring-1 ring-inset ring-[rgb(var(--raise)/0.14)]"
          : "text-muted-foreground hover:bg-[rgb(var(--raise)/0.05)] hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`font-mono text-[11px] tabular-nums ${
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
              <span className="w-11 shrink-0 font-mono text-[11px] font-semibold text-accent">
                {a.method}
              </span>
            )}
            <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-px font-mono text-[10.5px] font-semibold">
              {a.format}
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{a.displayName}</span>
            {a.preview && (
              <span className="hidden min-w-0 max-w-[38%] flex-1 truncate font-mono text-[12px] text-muted-foreground lg:block">
                {a.preview}
              </span>
            )}
            {a.status !== undefined && (
              <span
                className={`shrink-0 font-mono text-[11px] ${
                  a.status >= 400 ? "text-danger" : "text-muted-foreground"
                }`}
              >
                {a.status}
              </span>
            )}
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatBytes(a.bytes)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Shown on a button and bound to the key. One source, so they cannot drift. */
