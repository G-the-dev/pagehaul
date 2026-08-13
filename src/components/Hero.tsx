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

/**
 * The rotating word names what people actually came for, one asset type at a
 * time. It does the job a feature list would, in one line.
 */
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
  const words = useMemo(
    () => ["image", "icon", "video", "font", "document", "asset"],
    [],
  );

  useEffect(() => {
    const t = setTimeout(
      () => setIndex((n) => (n === words.length - 1 ? 0 : n + 1)),
      2200,
    );
    return () => clearTimeout(t);
  }, [index, words]);

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <h1 className="text-[2.5rem] font-medium leading-[1.05] tracking-tight sm:text-6xl">
          <span className="block">Every</span>
          <span className="relative flex h-[1.15em] w-full justify-center overflow-hidden">
            {words.map((w, i) => (
              <motion.span
                key={w}
                className="absolute font-semibold text-accent"
                initial={{ opacity: 0, y: 60 }}
                transition={{ type: "spring", stiffness: 60, damping: 14 }}
                animate={
                  index === i
                    ? { y: 0, opacity: 1 }
                    : { y: index > i ? -70 : 70, opacity: 0 }
                }
              >
                {w}
              </motion.span>
            ))}
          </span>
          <span className="block">on any page.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          Paste a link. See everything the page is built from, then take exactly
          what you need.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && !scanning) onScan();
          }}
          className="mx-auto mt-9 max-w-xl"
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
              className="h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-accent disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!url.trim() || scanning}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-accent-fg transition-all hover:brightness-110 disabled:opacity-40"
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

          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2/40 p-1">
            {(
              [
                [false, "Quick", "Reads the markup and stylesheets. Seconds."],
                [true, "Deep", "Runs the page in a browser. Finds far more."],
              ] as const
            ).map(([v, label, hint]) => (
              <button
                key={label}
                type="button"
                onClick={() => setDeep(v)}
                aria-pressed={deep === v}
                title={hint}
                className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
                  deep === v
                    ? "bg-surface text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-left text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
