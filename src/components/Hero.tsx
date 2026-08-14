"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { HeroBackdrop } from "./HeroBackdrop";
import { EASE } from "./ui/motion-primitives";
import { TryExamples } from "./TryExamples";

interface Props {
  url: string;
  setUrl: (v: string) => void;
  deep: boolean;
  setDeep: (v: boolean) => void;
  onScan: () => void;
  onPick: (host: string) => void;
  scanning: boolean;
  error: string | null;
}

const MODES = [
  { id: "quick" as const, label: "Quick", hint: "Reads the markup and stylesheets. A few seconds." },
  { id: "deep" as const, label: "Deep", hint: "Runs the page in a real browser. Finds far more." },
];

export function Hero({
  url,
  setUrl,
  deep,
  setDeep,
  onScan,
  onPick,
  scanning,
  error,
}: Props) {
  const [index, setIndex] = useState(0);
  const words = useMemo(() => ["image", "icon", "video", "font", "asset"], []);

  useEffect(() => {
    const t = setTimeout(
      () => setIndex((n) => (n === words.length - 1 ? 0 : n + 1)),
      2400,
    );
    return () => clearTimeout(t);
  }, [index, words]);

  return (
    <section className="relative isolate min-h-[92vh] overflow-hidden">
      <HeroBackdrop />

      {/* Scrim: the backdrop stays legible at the edges while the centre column
          keeps the contrast the headline needs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 46% 52% at 50% 42%, rgba(10,10,10,0.94) 30%, rgba(10,10,10,0.7) 55%, transparent 78%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-72"
        style={{ background: "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.85) 35%, rgba(10,10,10,0.35) 65%, transparent 100%)" }}
      />

      <div className="pointer-events-none relative z-20 mx-auto flex min-h-[92vh] max-w-3xl flex-col items-center justify-center px-6 py-28 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          className="text-balance text-[2.4rem] font-medium leading-[1.06] tracking-[-0.035em] sm:text-[3.6rem]"
        >
          Every{" "}
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
                    : { y: index > i ? "-118%" : "118%", opacity: 0 }
                }
              >
                {w}
              </motion.span>
            ))}
          </span>{" "}
          on any page.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
          className="mx-auto mt-6 max-w-md text-[15.5px] leading-relaxed text-muted-foreground"
        >
          Paste a link and see what a page is actually built from. Take one file,
          or take everything.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && !scanning) onScan();
          }}
          className="pointer-events-auto mx-auto mt-10 w-full max-w-lg"
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
              className="h-12 flex-1 rounded-lg border border-border bg-surface/80 px-4 text-[15px] backdrop-blur-md outline-none transition-colors placeholder:text-muted-foreground focus:border-border-strong disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!url.trim() || scanning}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-7 text-[14.5px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
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

          <div className="mt-4 flex flex-col items-center gap-2.5">
            <div
              role="radiogroup"
              aria-label="Scan depth"
              className="inline-flex rounded-lg border border-border bg-surface/80 p-1 backdrop-blur-md"
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
                    className={`rounded-md px-5 py-1.5 text-[13px] font-medium transition-colors ${
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
            <p className="text-[12.5px] text-muted-foreground">
              {MODES[deep ? 1 : 0].hint}
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-left text-[13.5px] text-danger">
              {error}
            </div>
          )}
        </motion.form>

        <TryExamples onPick={onPick} disabled={scanning} />
      </div>
    </section>
  );
}
