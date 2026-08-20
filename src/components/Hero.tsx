"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { EASE } from "./ui/motion-primitives";
import { TryExamples } from "./TryExamples";
import type { Recent } from "@/lib/recent";
import { checkUrlInput } from "@/lib/url-input";
import { ScanProgress } from "./ScanProgress";
import { Dithering } from "@paper-design/shaders-react";
import { useIsLight } from "@/lib/use-is-light";
import { useInView } from "@/lib/use-in-view";

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

/**
 * The dither field: a murmur, not a subject. Dim enough that the headline
 * owns the room, moving on its own, indifferent to the cursor.
 */
function HeroDither() {
  const light = useIsLight();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Dithering
      colorBack={light ? "#fafafa" : "#0a0a0a"}
      colorFront={light ? "#f0f0ee" : "#151517"}
      shape="warp"
      type="4x4"
      size={2}
      speed={1}
      minPixelRatio={1}
      maxPixelCount={700_000}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

const MODES = [
  { id: "quick" as const, label: "Quick", hint: "Reads the markup. Seconds." },
  { id: "deep" as const, label: "Deep", hint: "Real browser. Finds far more." },
];

function DitherLayer() {
  const [ref, inView] = useInView<HTMLDivElement>("0px");
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        maskImage: "linear-gradient(#000 0%, #000 72%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(#000 0%, #000 72%, transparent 100%)",
      }}
    >
      {inView && <HeroDither />}
    </div>
  );
}

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

  const words = useMemo(
    () => ["image", "icon", "video", "audio", "font", "3D asset"],
    [],
  );
  // The word edits itself the way a person would: erase back to whatever
  // the next word shares, then type the rest. The left of the sentence
  // never moves, the selection frame never blinks out; it just follows
  // the text as it shortens and grows.
  const [word, setWord] = useState(words[0]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let wi = 0;
    const later = (fn: () => void, ms: number) =>
      window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    const change = () => {
      const cur = words[wi];
      wi = (wi + 1) % words.length;
      const next = words[wi];
      let keep = 0;
      while (keep < cur.length && keep < next.length && cur[keep] === next[keep]) keep++;
      let pos = cur.length;
      setEditing(true);
      const erase = () => {
        if (pos > keep) {
          pos -= 1;
          setWord(cur.slice(0, pos));
          later(erase, 45);
        } else {
          type();
        }
      };
      const type = () => {
        if (pos < next.length) {
          pos += 1;
          setWord(next.slice(0, pos));
          later(type, 62);
        } else {
          setEditing(false);
          later(change, 2500);
        }
      };
      erase();
    };
    later(change, 2500);
    return () => {
      cancelled = true;
    };
  }, [words]);

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
      {/* The brand as weather: an ordered-dither field in slow motion over
          the whole hero, running only while the hero is on screen. */}
      <DitherLayer />

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
              <span className="col-start-1 row-start-1 grid justify-items-start">
                <span className="relative inline-block whitespace-nowrap px-[0.14em] font-semibold">
                  <span className="invisible absolute">M</span>
                  {word}
                  {editing && (
                    <span
                      aria-hidden
                      className="absolute top-[0.16em] bottom-[0.08em] ml-[0.02em] inline-block w-[2px] animate-pulse bg-foreground/80"
                    />
                  )}
                  {/* The selection frame never unmounts. It rides the text,
                      shrinking and growing with each keystroke of the edit. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-[0.08em] bottom-0 rounded-[0.1em] border border-accent-line bg-accent-soft/40"
                  >
                    <span className="absolute -left-[3.5px] -top-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                    <span className="absolute -right-[3.5px] -top-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                    <span className="absolute -bottom-[3.5px] -left-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                    <span className="absolute -bottom-[3.5px] -right-[3.5px] h-[7px] w-[7px] rounded-[1.5px] border border-accent-line bg-background" />
                  </span>
                </span>
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
              {deep && freeDeepLeft != null && (
                <>
                  {" · "}
                  {freeDeepLeft > 0 ? (
                    `${freeDeepLeft} free left`
                  ) : (
                    <a
                      href="/#pricing"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      0 free left · pricing
                    </a>
                  )}
                </>
              )}
            </p>
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
