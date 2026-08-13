"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

interface Props {
  url: string;
  setUrl: (v: string) => void;
  deep: boolean;
  setDeep: (v: boolean) => void;
  onScan: () => void;
  scanning: boolean;
  error: string | null;
}

const MODES = [
  {
    id: "quick" as const,
    label: "Quick",
    hint: "Reads the markup and stylesheets. Takes a few seconds.",
  },
  {
    id: "deep" as const,
    label: "Deep",
    hint: "Runs the page in a real browser. Finds far more, takes longer.",
  },
];

export function Hero({
  url,
  setUrl,
  deep,
  setDeep,
  onScan,
  scanning,
  error,
}: Props) {
  const [index, setIndex] = useState(0);
  // Kept to a similar character count so the inline slot stays a stable width
  // and the headline never reflows mid-rotation.
  const words = useMemo(() => ["image", "icon", "video", "font", "asset"], []);

  useEffect(() => {
    const t = setTimeout(
      () => setIndex((n) => (n === words.length - 1 ? 0 : n + 1)),
      2200,
    );
    return () => clearTimeout(t);
  }, [index, words]);

  const activeHint = MODES[deep ? 1 : 0].hint;

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Subtle light fall from the top. Neutral, so it reads as depth rather
          than colour. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(ellipse 55% 60% at 50% -10%, rgba(255,255,255,0.07), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-6 pb-20 pt-24 text-center sm:pt-32">
        <h1 className="text-balance text-[2.25rem] font-medium leading-[1.08] tracking-tight sm:text-[3.25rem]">
          Every{" "}
          {/* All words share one grid cell, so the slot sizes to the widest and
              nothing shifts as they swap. */}
          <span className="inline-grid overflow-hidden align-baseline">
            {words.map((w, i) => (
              <motion.span
                key={w}
                aria-hidden={index !== i}
                className="col-start-1 row-start-1 whitespace-nowrap font-semibold"
                initial={false}
                transition={{ type: "spring", stiffness: 70, damping: 15 }}
                animate={
                  index === i
                    ? { y: "0%", opacity: 1 }
                    : { y: index > i ? "-115%" : "115%", opacity: 0 }
                }
              >
                {w}
              </motion.span>
            ))}
          </span>{" "}
          on any page.
        </h1>

        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Paste a link. See everything the page is built from, then take exactly
          what you need.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && !scanning) onScan();
          }}
          className="mx-auto mt-9 max-w-lg"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="stripe.com"
              aria-label="Website link"
              disabled={scanning}
              className="h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!url.trim() || scanning}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning
                </>
              ) : (
                <>
                  Scan
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Segmented control. The selected side is filled and light so the
              choice is unmistakable at a glance. */}
          <div className="mt-4 flex flex-col items-center gap-2.5">
            <div
              role="radiogroup"
              aria-label="Scan depth"
              className="inline-flex rounded-lg border border-border bg-surface p-1"
            >
              {MODES.map((m) => {
                const active = (m.id === "deep") === deep;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDeep(m.id === "deep")}
                    className={`relative rounded-md px-5 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[12.5px] text-muted-foreground">{activeHint}</p>
          </div>
        </form>

        {error && (
          <div className="mx-auto mt-6 max-w-lg rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-left text-[13.5px] text-danger">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
