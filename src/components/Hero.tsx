"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { EASE } from "./ui/motion-primitives";
import { TryExamples } from "./TryExamples";
import type { Recent } from "@/lib/recent";
import { checkUrlInput } from "@/lib/url-input";
import { ScanProgress } from "./ScanProgress";
import { DotMatrix } from "./DotMatrix";

interface Props {
  url: string;
  setUrl: (v: string) => void;
  deep: boolean;
  setDeep: (v: boolean) => void;
  onScan: () => void;
  onPick: (host: string) => void;
  onCancel: () => void;
  recent: Recent[];
  onRemoveRecent: (url: string) => void;
  scanning: boolean;
  error: string | null;
  /**
   * Free deep-scan sites remaining, or null for someone who has no counter
   * to think about (paid, or the plan has not loaded yet).
   */
  freeDeepLeft?: number | null;
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
  onCancel,
  recent,
  onRemoveRecent,
  scanning,
  error,
  freeDeepLeft,
}: Props) {
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The first thing anybody does here is paste a link, and a paste needs
  // somewhere to land — so the box is focused on arrival, like a search
  // engine's. Desktop only: on a phone, autofocus throws the keyboard over
  // half the page before the person has read a word of it.
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  // Paste works from anywhere on the page. Clicking blank space drops focus,
  // and a person with a copied link should not have to find the box again —
  // if the paste lands nowhere editable and looks like an address, it goes
  // where it was obviously meant to go.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (scanning) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      const text = (e.clipboardData?.getData("text") ?? "").trim().split("\n")[0];
      if (!text || /\s/.test(text)) return;
      // We are the paste now. Without this the browser also performs its own
      // default paste — into the input we are about to focus — and the link
      // lands twice, back to back.
      e.preventDefault();
      setUrl(text);
      setTouched(false);
      inputRef.current?.focus();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [scanning, setUrl]);
  const check = checkUrlInput(url);
  // Only complain once they have left the field, so it does not shout at
  // someone halfway through typing "stripe.c".
  const inputError = touched && url.trim() && !check.ok ? check.message : null;

  const [index, setIndex] = useState(0);
  const words = useMemo(
    () => ["image", "icon", "video", "audio track", "font", "3D asset"],
    [],
  );

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
      {/* The tile logo as weather: a field of clustered dots behind the
          headline, masked out before the copy has to fight it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{
          maskImage:
            "radial-gradient(ellipse 62% 64% at 50% 0%, #000 14%, transparent 74%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 62% 64% at 50% 0%, #000 14%, transparent 74%)",
        }}
      >
        <DotMatrix className="h-full w-full opacity-70" />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          className="text-balance text-[2.6rem] font-medium leading-[1.06] tracking-[-0.035em] sm:text-[3.9rem]"
        >
          {/*
            The rotating word sits at the END of the heading and inside a slot
            sized by the widest word in the set, stacked invisibly beneath it.
            The line's length is therefore constant: nothing re-centres,
            nothing reflows, whichever word is up. Words hand over with a
            short blur-fade rather than a slide, and the selection frame hugs
            each word and fades with it, so the change reads as the selection
            moving on, not the sentence moving around.
          */}
          <span className="block">Any page, one click,</span>
          <span className="block whitespace-nowrap">
            every{" "}
            <span className="relative inline-grid align-baseline">
              {words.map((w) => (
                <span
                  key={w}
                  aria-hidden
                  className="invisible col-start-1 row-start-1 whitespace-nowrap px-[0.14em] font-semibold"
                >
                  {w}
                </span>
              ))}
              <span className="col-start-1 row-start-1 grid place-items-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, filter: "blur(7px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(7px)" }}
                    transition={{ duration: 0.32, ease: EASE }}
                    className="relative inline-block whitespace-nowrap px-[0.14em] font-semibold"
                  >
                    {words[index]}
                    {/* The selection frame: kept shallow, capline to baseline,
                        with the four grab handles. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-[0.1em] bottom-[0.06em] rounded-[0.1em] border border-accent-line bg-accent-soft/40"
                    >
                      <span className="absolute -left-[3.5px] -top-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                      <span className="absolute -right-[3.5px] -top-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                      <span className="absolute -bottom-[3.5px] -left-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                      <span className="absolute -bottom-[3.5px] -right-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                    </span>
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
          className="mx-auto mt-6 max-w-md text-[16.5px] leading-relaxed text-muted-foreground"
        >
          Paste a link. Every file the page is built from shows up named and
          previewed. Take one, or take all of it.
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
              ref={inputRef}
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={!!inputError}
              aria-describedby={inputError || error ? "scan-error" : undefined}
              placeholder="stripe.com"
              aria-label="Website link"
              disabled={scanning}
              // sm:flex-1, never flex-1: on the phone this container stacks as
              // a column, and a flex-basis of 0% on the column's main axis
              // overrides h-12 entirely — the box collapsed to its text
              // height, 23px, while the button beside it stood at 48.
              // text-[17px] below sm: iOS zooms the whole page into any input
              // whose text is under 16px, which reads as the layout jumping.
              className={`h-12 rounded-lg border bg-surface/80 px-4 text-[17px] backdrop-blur-md outline-none transition-colors placeholder:text-muted-foreground disabled:opacity-60 sm:flex-1 sm:text-[16px] ${
                inputError ? "border-danger/60" : "border-border focus:border-border-strong"
              }`}
            />
            <button
              type="submit"
              disabled={!url.trim() || scanning}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-7 text-[15.5px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
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

          {/* Sits against the field it describes. Below the mode toggle it was
              two controls away from the thing that was wrong. */}
          {(inputError || error) && (
            <p
              id="scan-error"
              role="alert"
              className="mt-2 text-left text-[14px] text-danger"
            >
              {inputError ?? error}
            </p>
          )}

          <div className="mt-4 flex flex-col items-center gap-2.5">
            <div
              role="radiogroup"
              aria-label="Scan depth"
              className={`inline-flex rounded-lg border border-border bg-surface/80 p-1 backdrop-blur-md transition-opacity ${
                scanning ? "opacity-55" : ""
              }`}
            >
              {MODES.map((m) => {
                const active = (m.id === "deep") === deep;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    // Locked while a scan is in flight. The depth was decided
                    // when the scan started and cannot change under it, so
                    // letting the control move only makes the page describe a
                    // scan that is not the one running.
                    disabled={scanning}
                    onClick={() => setDeep(m.id === "deep")}
                    className={`rounded-md px-5 py-1.5 text-[14px] font-medium transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    } ${scanning ? "pointer-events-none" : ""}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[13.5px] text-muted-foreground">
              {MODES[deep ? 1 : 0].hint}
            </p>
            {/* The allowance, said plainly where the choice is made, not in
                a settings page discovered after the wall. */}
            {deep && freeDeepLeft != null && (
              <p className="text-[12.5px] text-muted-foreground/80">
                {freeDeepLeft > 0 ? (
                  <>
                    {freeDeepLeft} free deep scan{freeDeepLeft === 1 ? "" : "s"} left
                  </>
                ) : (
                  <>
                    Free deep scans used ·{" "}
                    <a href="/#pricing" className="underline underline-offset-2 hover:text-foreground">
                      pricing
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

        </motion.form>

        {scanning ? (
          <ScanProgress deep={deep} onCancel={onCancel} />
        ) : (
          <TryExamples
            onPick={onPick}
            recent={recent}
            onRemove={onRemoveRecent}
            disabled={scanning}
          />
        )}
      </div>
    </section>
  );
}
