"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { Asset, AssetKind } from "@/lib/types";
import { KIND_LABEL, KIND_ORDER } from "@/lib/types";
import { formatBytes } from "@/lib/download";
import type { ZipProgress } from "@/lib/download";

/**
 * The phone's version of the results.
 *
 * A phone is the wrong place to pore over four hundred tiles — the desktop
 * grid exists for that. What a phone is good for is the decision: which
 * kinds of file do you want? So the results become a short list of kinds
 * with counts and sizes, everything ticked, and one button that hands over
 * a zip. Network calls, code and data stay off the list; nobody triages
 * XHR responses on a phone.
 */

const OFFERED: AssetKind[] = [
  "image",
  "screenshot",
  "svg",
  "video",
  "audio",
  "font",
  "document",
];

export function MobileHaul({
  assets,
  busy,
  progress,
  onDownload,
}: {
  /** Deduped cards — one per picture family, hidden variants already gone. */
  assets: Asset[];
  busy: boolean;
  progress: ZipProgress | null;
  onDownload: (chosen: Asset[]) => void;
}) {
  const groups = useMemo(
    () =>
      OFFERED.map((kind) => {
        const list = assets.filter((a) => a.kind === kind && !a.noise);
        return {
          kind,
          list,
          bytes: list.reduce((n, a) => n + (a.bytes ?? 0), 0),
        };
      }).filter((g) => g.list.length > 0),
    [assets],
  );

  // Everything starts ticked, the same stance as the desktop picker: people
  // remove what they do not want rather than build a selection from nothing.
  const [off, setOff] = useState<Set<AssetKind>>(new Set());
  const toggle = (kind: AssetKind) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const chosen = groups.filter((g) => !off.has(g.kind));
  const files = chosen.reduce((n, g) => n + g.list.length, 0);
  const bytes = chosen.reduce((n, g) => n + g.bytes, 0);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border">
        {groups.map((g, i) => {
          const on = !off.has(g.kind);
          return (
            <button
              key={g.kind}
              type="button"
              onClick={() => toggle(g.kind)}
              aria-pressed={on}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                i > 0 ? "border-t border-border" : ""
              } ${on ? "bg-surface" : "bg-surface-2/40"}`}
            >
              <span
                aria-hidden
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                  on
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border-strong"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <span
                className={`flex-1 text-[14.5px] font-medium ${on ? "" : "text-muted-foreground"}`}
              >
                {KIND_LABEL[g.kind]}
              </span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {g.list.length} file{g.list.length === 1 ? "" : "s"}
                {g.bytes > 0 && ` · ${formatBytes(g.bytes)}`}
              </span>
            </button>
          );
        })}
      </div>

      {progress && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={files === 0 || busy}
        onClick={() =>
          onDownload(chosen.flatMap((g) => g.list))
        }
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
      >
        {busy
          ? "Working…"
          : `Download ${files} file${files === 1 ? "" : "s"} as zip${bytes > 0 ? ` · ${formatBytes(bytes)}` : ""}`}
      </button>

      <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
        Files arrive as one zip, sorted into folders by kind. Browsing and
        previewing each file lives in the desktop version.
      </p>
    </div>
  );
}
