"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { EASE } from "./ui/motion-primitives";
import { TryExamples } from "./TryExamples";
import { checkUrlInput } from "@/lib/url-input";
import { ScanProgress } from "./ScanProgress";

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
  const [touched, setTouched] = useState(false);
  const check = checkUrlInput(url);
  // Only complain once they have left the field, so it does not shout at
  // someone halfway through typing "stripe.c".
  const inputError = touched && url.trim() && !check.ok ? check.message : null;

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
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden">
      {/* A quiet ground: one soft light from above and a faint grid that fades
          out well before the copy begins. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% -8%, rgb(var(--glow) / 0.055), transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-40"
        style={{
          maskImage:
            "radial-gradient(ellipse 55% 60% at 50% 0%, #000 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 55% 60% at 50% 0%, #000 10%, transparent 70%)",
        }}
      />

      <div className="relative z-20 mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          className="text-balance text-[2.4rem] font-medium leading-[1.06] tracking-[-0.035em] sm:text-[3.6rem]"
        >
          Every{" "}
          {/*
            Only one word is animated at a time, so it always enters from below
            and leaves upward. Positioning words by their index made the motion
            reverse on the wrap from the last word back to the first, because
            the first was sitting above rather than below.

            The invisible copies share the same grid cell purely to hold the
            slot at the width of the longest word, so the headline never
            reflows mid rotation.
          */}
          <span className="relative inline-grid overflow-hidden align-baseline">
            {words.map((w) => (
              <span
                key={w}
                aria-hidden
                className="invisible col-start-1 row-start-1 whitespace-nowrap font-semibold"
              >
                {w}
              </span>
            ))}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={index}
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-110%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 90, damping: 17 }}
                className="col-start-1 row-start-1 whitespace-nowrap font-semibold"
              >
                {words[index]}
              </motion.span>
            </AnimatePresence>
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
            setTouched(true);
            // Nothing is submitted until it could plausibly resolve.
            if (check.ok && !scanning) onScan();
          }}
          className="mx-auto mt-10 w-full max-w-lg"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={!!inputError}
              placeholder="stripe.com"
              aria-label="Website link"
              disabled={scanning}
              className={`h-12 flex-1 rounded-lg border bg-surface/80 px-4 text-[15px] backdrop-blur-md outline-none transition-colors placeholder:text-muted-foreground disabled:opacity-60 ${
                inputError ? "border-danger/60" : "border-border focus:border-border-strong"
              }`}
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

          {(inputError || error) && (
            <p className="mt-3 text-left text-[13px] text-danger">
              {inputError ?? error}
            </p>
          )}
        </motion.form>

        {scanning ? (
          <ScanProgress deep={deep} />
        ) : (
          <TryExamples onPick={onPick} disabled={scanning} />
        )}
      </div>
    </section>
  );
}
