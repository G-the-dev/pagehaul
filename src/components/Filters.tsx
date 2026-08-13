"use client";

import type { Asset, AssetKind } from "@/lib/types";
import { KIND_LABEL, KIND_ORDER } from "@/lib/types";

export interface FilterState {
  kinds: Set<AssetKind>;
  formats: Set<string>;
  pages: Set<string>;
  minWidth: number;
  largestOnly: boolean;
  transparentOnly: boolean;
  firstPartyOnly: boolean;
  search: string;
}

export const emptyFilters = (): FilterState => ({
  kinds: new Set(),
  formats: new Set(),
  pages: new Set(),
  minWidth: 0,
  // On by default: without this a single srcset family shows as four near-identical tiles.
  largestOnly: true,
  transparentOnly: false,
  firstPartyOnly: false,
  search: "",
});

export function applyFilters(assets: Asset[], f: FilterState): Asset[] {
  const q = f.search.trim().toLowerCase();
  return assets.filter((a) => {
    if (f.largestOnly && a.variantKey && a.isLargest === false) return false;
    if (f.kinds.size && !f.kinds.has(a.kind)) return false;
    if (f.formats.size && !f.formats.has(a.format)) return false;
    if (f.pages.size && !f.pages.has(a.fromPage)) return false;
    if (f.transparentOnly && !a.transparent) return false;
    if (f.firstPartyOnly && a.origin !== "first-party") return false;
    if (f.minWidth > 0 && (a.width ?? 0) < f.minWidth) return false;
    if (q) {
      const hay = `${a.name} ${a.format} ${a.alt ?? ""} ${a.url}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function countBy<T extends string>(assets: Asset[], pick: (a: Asset) => T): Map<T, number> {
  const m = new Map<T, number>();
  for (const a of assets) {
    const k = pick(a);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

interface Props {
  assets: Asset[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
}

function Row({
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        disabled
          ? "cursor-not-allowed text-muted/50"
          : active
            ? "bg-accent-soft font-semibold text-accent"
            : "text-fg-2 hover:bg-tile"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums">{count}</span>
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted first:mt-0">
      {children}
    </div>
  );
}

export function Filters({ assets, filters, onChange }: Props) {
  const kindCounts = countBy(assets, (a) => a.kind);
  // Format and page counts reflect the kind selection, so the rail narrows sensibly.
  const scoped = filters.kinds.size
    ? assets.filter((a) => filters.kinds.has(a.kind))
    : assets;
  const formatCounts = countBy(scoped, (a) => a.format);
  const pageCounts = countBy(assets, (a) => a.fromPage);

  const toggle = <T,>(set: Set<T>, v: T): Set<T> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const topFormats = [...formatCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const pages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <aside className="w-full shrink-0 border-line md:w-[210px] md:border-r md:pr-4">
      <Label>Type</Label>
      {KIND_ORDER.map((k) => {
        const n = kindCounts.get(k) ?? 0;
        return (
          <Row
            key={k}
            label={KIND_LABEL[k]}
            count={n}
            active={filters.kinds.has(k)}
            disabled={n === 0}
            onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, k) })}
          />
        );
      })}

      {topFormats.length > 1 && (
        <>
          <Label>Format</Label>
          {topFormats.map(([fmt, n]) => (
            <Row
              key={fmt}
              label={fmt}
              count={n}
              active={filters.formats.has(fmt)}
              onClick={() => onChange({ ...filters, formats: toggle(filters.formats, fmt) })}
            />
          ))}
        </>
      )}

      <Label>Minimum width</Label>
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={2400}
          step={100}
          value={filters.minWidth}
          onChange={(e) => onChange({ ...filters, minWidth: Number(e.target.value) })}
          aria-label="Minimum image width in pixels"
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted">
          {filters.minWidth === 0 ? "any width" : `${filters.minWidth}px and wider`}
        </div>
      </div>

      {pages.length > 1 && (
        <>
          <Label>From page</Label>
          {pages.slice(0, 12).map(([p, n]) => {
            let short = p;
            try {
              short = new URL(p).pathname || "/";
            } catch {
              /* keep the raw string */
            }
            return (
              <Row
                key={p}
                label={short}
                count={n}
                active={filters.pages.has(p)}
                onClick={() => onChange({ ...filters, pages: toggle(filters.pages, p) })}
              />
            );
          })}
        </>
      )}
    </aside>
  );
}

/** One-click filter combinations people would otherwise have to build by hand. */
export const PRESETS: {
  id: string;
  label: string;
  apply: (f: FilterState) => FilterState;
  isOn: (f: FilterState) => boolean;
}[] = [
  {
    id: "largest",
    label: "Largest version only",
    apply: (f) => ({ ...f, largestOnly: !f.largestOnly }),
    isOn: (f) => f.largestOnly,
  },
  {
    id: "logos",
    label: "Logos",
    apply: (f) =>
      f.transparentOnly && f.minWidth === 0
        ? { ...f, transparentOnly: false }
        : { ...f, transparentOnly: true, minWidth: 0 },
    isOn: (f) => f.transparentOnly && f.minWidth === 0,
  },
  {
    id: "big",
    label: "Over 1000px",
    apply: (f) => ({ ...f, minWidth: f.minWidth >= 1000 ? 0 : 1000 }),
    isOn: (f) => f.minWidth >= 1000,
  },
  {
    id: "mine",
    label: "Hide third-party",
    apply: (f) => ({ ...f, firstPartyOnly: !f.firstPartyOnly }),
    isOn: (f) => f.firstPartyOnly,
  },
];
