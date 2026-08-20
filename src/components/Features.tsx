"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { EASE, Reveal, Section, SectionHead, Card } from "./ui/motion-primitives";

/* ------------------------------------------------------------------ *
 * Visuals. Each demonstrates its claim; none is decoration.
 * ------------------------------------------------------------------ */

const TILE = "rounded-md";

/**
 * A shared clock for looping visuals: progress 0..1 over the duration,
 * frozen at a finished frame for anyone who asked their OS for less motion.
 */
function useLoop(durationMs: number): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      setP(((t - t0) % durationMs) / durationMs);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs]);
  return p;
}

/** The mono eyebrow + status pill header every fragment card opens with. */
function FragmentHead({ label, pill }: { label: string; pill: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2 py-0.5">
        <motion.span
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-1.5 w-1.5 rounded-full bg-foreground"
        />
        <span className="font-mono text-[8.5px] uppercase tracking-wide text-fg-2">{pill}</span>
      </span>
    </div>
  );
}

/**
 * The scan, as its own log: timestamped lines landing one after another,
 * the way the product actually reports a deep scan. The claim is the card.
 */
function CoverageVisual({ active: _active }: { active: boolean }) {
  const p = useLoop(7000);
  const rows = [
    { t: "0.8s", m: "+", body: "206 images", tail: "webp · avif", at: 0.06 },
    { t: "1.4s", m: "+", body: "41 icons", tail: "inline svg", at: 0.2 },
    { t: "2.2s", m: "+", body: "9 fonts", tail: "woff2", at: 0.34 },
    { t: "3.6s", m: "~", body: "6 sections", tail: "screenshots", at: 0.48 },
    { t: "5.1s", m: "\u2713", body: "Scan complete", tail: "466 files", at: 0.64, done: true },
  ];
  return (
    <div className="flex h-full items-center">
      <div className="w-full overflow-hidden rounded-lg border border-border bg-background shadow-soft">
        <FragmentHead label="Deep scan · stripe.com" pill="Live" />
        <div className="space-y-[3px] px-3 py-2.5 font-mono text-[10.5px]">
          {rows.map((r) => {
            const on = p >= r.at;
            return (
              <div
                key={r.t}
                className="flex items-center gap-2 transition-all duration-300"
                style={{
                  opacity: on ? 1 : 0.12,
                  transform: on ? "translateY(0)" : "translateY(4px)",
                }}
              >
                <span className="text-muted-foreground/70">{r.t}</span>
                <span className={r.done ? "text-foreground" : "text-muted-foreground"}>
                  {r.m}
                </span>
                <span className={r.done ? "font-semibold text-foreground" : "text-fg-2"}>
                  {r.body}
                </span>
                <span className="ml-auto text-muted-foreground/70">{r.tail}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * One file chosen and taken: the cursor drifts to a thumbnail, the tile
 * answers, and the receipt arrives as a toast. Watching it is the pitch.
 */
function PrecisionVisual({ active: _active }: { active: boolean }) {
  const p = useLoop(6400);
  const seg = (from: number, to: number, a: number, b: number) =>
    p <= from ? a : p >= to ? b : a + ((p - from) / (to - from)) * (b - a);
  const cx = seg(0.05, 0.32, 86, 48);
  const cy = seg(0.05, 0.32, 88, 42);
  const picked = p >= 0.36 && p < 0.94;
  const toast = p >= 0.44 && p < 0.9;
  const THUMBS = [
    "linear-gradient(135deg,#3a3a3d,#232326)",
    "linear-gradient(160deg,#2c2c2f,#1a1a1c)",
    "linear-gradient(120deg,#48484c,#2a2a2d)",
    "linear-gradient(150deg,#242427,#161618)",
    "linear-gradient(135deg,#565659,#39393c)",
    "linear-gradient(140deg,#2e2e31,#1d1d1f)",
    "linear-gradient(125deg,#3f3f42,#252528)",
    "linear-gradient(155deg,#27272a,#19191b)",
    "linear-gradient(130deg,#333336,#202023)",
  ];
  return (
    <div className="flex h-full items-center">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-background shadow-soft">
        <FragmentHead label="Results · images" pill="12 found" />
        <div className="grid grid-cols-3 gap-1.5 p-2.5">
          {THUMBS.map((bg, i) => {
            const pick = i === 4;
            return (
              <div
                key={i}
                className={"h-9 rounded-[5px] transition-all duration-300 " + (
                  pick && picked
                    ? "ring-2 ring-accent-line ring-offset-2 ring-offset-background"
                    : !pick && picked
                      ? "opacity-30"
                      : ""
                )}
                style={{ background: bg }}
              />
            );
          })}
        </div>
        <svg
          viewBox="0 0 24 24"
          className="absolute z-10 h-4 w-4 text-foreground drop-shadow"
          style={{ left: cx + "%", top: cy + "%" }}
          fill="currentColor"
        >
          <path d="M5 3l14 8-6.5 1.5L9 19z" />
        </svg>
        {/* The receipt, floating dark, the way a toast should. */}
        <div
          className="absolute inset-x-6 bottom-2 z-10 flex items-center justify-center gap-2 rounded-full bg-foreground px-3 py-1.5 text-background shadow-soft transition-all duration-300"
          style={{
            opacity: toast ? 1 : 0,
            transform: toast ? "translateY(0)" : "translateY(10px)",
          }}
        >
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="font-mono text-[9.5px]">hero@2x.webp · 214 KB</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The design tab assembling itself: swatches with their share of the page,
 * the type, the tokens typed live, and where you can take them.
 */
function DesignVisual({ active: _active }: { active: boolean }) {
  const p = useLoop(7200);
  const swatches = [
    { c: "#fafafa", n: "62%" },
    { c: "#a1a1a1", n: "21%" },
    { c: "#525252", n: "11%" },
    { c: "#262626", n: "6%" },
  ];
  const token = "--font-sans: Inter";
  const typedT = Math.max(0, Math.min(1, (p - 0.42) / 0.18));
  const typed = token.slice(0, Math.round(typedT * token.length));
  const chips = ["CSS variables", "Figma tokens", "Tailwind"];
  return (
    <div className="flex h-full items-center">
      <div className="w-full overflow-hidden rounded-lg border border-border bg-background shadow-soft">
        <FragmentHead label="Design system" pill="Read" />
        <div className="space-y-2.5 p-3">
          <div className="flex gap-1.5">
            {swatches.map((sw, i) => {
              const on = p >= 0.06 + i * 0.07;
              return (
                <div
                  key={sw.c}
                  className="flex-1 overflow-hidden rounded-[5px] border border-border transition-all duration-300"
                  style={{
                    opacity: on ? 1 : 0.12,
                    transform: on ? "translateY(0)" : "translateY(5px)",
                  }}
                >
                  <div className="h-6 w-full" style={{ background: sw.c }} />
                  <div className="bg-surface-2 py-px text-center font-mono text-[8px] text-muted-foreground">
                    {sw.n}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="flex h-[20px] items-center rounded-[5px] bg-surface-2/70 px-2 font-mono text-[10px] text-fg-2 transition-opacity duration-300"
            style={{ opacity: p >= 0.4 ? 1 : 0.12 }}
          >
            {typed}
            {typedT > 0 && typedT < 1 && (
              <span className="ml-px h-3 w-px bg-foreground" />
            )}
          </div>
          <div className="flex gap-1.5">
            {chips.map((c, i) => {
              const on = p >= 0.68 + i * 0.08;
              return (
                <span
                  key={c}
                  className="rounded-md border border-border bg-surface-2/50 px-2 py-1 font-mono text-[8.5px] text-muted-foreground transition-all duration-300"
                  style={{
                    opacity: on ? 1 : 0.12,
                    transform: on ? "translateY(0)" : "translateY(4px)",
                  }}
                >
                  {c}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    tag: "Coverage",
    title: "Nothing stays hidden",
    body: "CSS backgrounds, every srcset size, fonts, video, API responses. If the page loads it, it shows up.",
    Visual: CoverageVisual,
  },
  {
    tag: "Precision",
    title: "One file, not the archive",
    body: "Click a file and it downloads, alone, named like a person would name it.",
    Visual: PrecisionVisual,
  },
  {
    tag: "Design",
    title: "Read the design itself",
    body: "The palette it paints with, the type it sets, the tokens underneath. Read from the live page.",
    Visual: DesignVisual,
  },
];

export function Features() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <Section tone="raised" id="what">
      <SectionHead
        eyebrow="What you get"
        title={
          <>
            A page is not one thing.
            <br />
            It is a few hundred.
          </>
        }
      />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.1}>
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="h-full"
            >
              <Card className="flex h-full flex-col">
                <div className="p-6 pb-0">
                  <div className="relative h-[190px]">
                    <div aria-hidden className="hatch absolute -inset-x-6 -top-6 bottom-0 opacity-70" style={{ maskImage: "linear-gradient(#000 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(#000 55%, transparent 100%)" }} />
                    <div className="relative h-full">
                      <f.Visual active={hovered === i} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6 pt-7">
                  <div className="label-mono mb-3">{f.tag}</div>
                  <h3 className="mb-2 text-[17.5px] font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Card>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Steps
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    h: "Paste a link",
    p: "Any public page. Quick reads the markup; deep runs the page in a real browser.",
  },
  {
    n: "02",
    h: "See what it is made of",
    p: "Images, icons, video, fonts, documents and network calls, named so you can tell them apart.",
  },
  {
    n: "03",
    h: "Take what you need",
    p: "One file downloads on its own. A selection arrives as a zip with a manifest.",
  },
];

/**
 * Step one: an address being typed, over and over.
 *
 * These loop rather than playing once on scroll, because the section is about
 * a process and a still frame does not read as one.
 */
function PasteVisual() {
  const full = "stripe.com";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    let hold = 0;
    const t = setInterval(() => {
      if (hold > 0) {
        hold -= 1;
        return;
      }
      if (i <= full.length) {
        setTyped(full.slice(0, i));
        i += 1;
        if (i > full.length) hold = 18; // pause on the finished address
      } else {
        i = 0;
        setTyped("");
      }
    }, 130);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-full items-center">
      <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-surface-3" />
        <span className="font-mono text-[12.5px] text-fg-2">{typed}</span>
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-3.5 w-px bg-foreground"
        />
        <span className="ml-auto shrink-0 rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background">
          Scan
        </span>
      </div>
    </div>
  );
}

/** Step two: counts climbing as files are found. */
function FoundVisual() {
  const rows = useMemo(
    () => [
      { k: "Images", n: 206 },
      { k: "Icons", n: 123 },
      { k: "Fonts", n: 9 },
    ],
    [],
  );
  const [counts, setCounts] = useState<number[]>([0, 0, 0]);

  useEffect(() => {
    let frame = 0;
    const total = 70;
    const t = setInterval(() => {
      frame += 1;
      if (frame > total + 26) {
        frame = 0;
        setCounts([0, 0, 0]);
        return;
      }
      const p = Math.min(1, frame / total);
      // Ease out, so the numbers slow as they land rather than stopping dead.
      const eased = 1 - Math.pow(1 - p, 3);
      setCounts(rows.map((r) => Math.round(r.n * eased)));
    }, 40);
    return () => clearInterval(t);
  }, [rows]);

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {rows.map((r, i) => (
        <div
          key={r.k}
          className="flex items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-2"
        >
          <span className="h-5 w-5 shrink-0 rounded bg-surface-3" />
          <span className="text-[12.5px] text-fg-2">{r.k}</span>
          <span className="ml-auto font-mono text-[11.5px] tabular-nums text-muted-foreground">
            {counts[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Step three: one file lifting clear, then settling back. */
function TakeVisual() {
    return (
    <div className="flex h-full items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => {
        const pick = i === 1;
        return (
          <motion.div
            key={i}
            animate={
              pick
                  ? { y: [0, -10, -10, 0] }
                  : { opacity: [1, 0.4, 0.4, 1] }
            }
            transition={
              {
                    duration: 2.8,
                    times: [0, 0.25, 0.7, 1],
                    repeat: Infinity,
                    repeatDelay: 0.7,
                    ease: EASE,
                  }
            }
            className={`h-14 flex-1 rounded-md ${
              pick ? "relative bg-foreground" : "bg-surface-2"
            }`}
          >
            {pick && (
              <span className="absolute inset-0 grid place-items-center">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-background"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
                </svg>
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

const STEP_VISUALS = [PasteVisual, FoundVisual, TakeVisual];

export function Steps() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, no account." />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {STEPS.map((s, i) => {
          const Visual = STEP_VISUALS[i];
          return (
            <Reveal key={s.n} delay={i * 0.1}>
              {/* No divider between visual and copy, and no rule beside the
                  number. Space separates them; a line is not needed. */}
              <Card className="flex h-full flex-col">
                <div className="h-[104px] p-5">
                  <Visual />
                </div>
                {/* The visuals overflow their box and are clipped by the card,
                    so the padding underneath them is not real space — the
                    number sat against a cut-off edge. This gap is the
                    separation. */}
                <div className="flex flex-1 flex-col p-5 pt-7">
                  <div className="mb-2.5 font-mono text-[12px] font-semibold text-muted-foreground">
                    {s.n}
                  </div>
                  <h3 className="mb-2 text-[17px] font-semibold tracking-tight">
                    {s.h}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                    {s.p}
                  </p>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Audience
 * ------------------------------------------------------------------ */

/**
 * Each audience gets a small drawn mark of what they actually take away. Four
 * text blocks in a row read as filler; showing the thing gives the section a
 * reason to exist.
 */
function DesignerMark() {
    return (
    <div className="flex gap-1.5">
      {["#fafafa", "#a1a1a1", "#525252", "#2e2e2e"].map((c, i) => (
        <motion.span
          key={c}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
          className="h-6 w-6 rounded-md border border-border"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function DeveloperMark() {
    return (
    <div className="flex w-full max-w-[130px] flex-col gap-1.5">
      {[
        [100, 74],
        [62, 88],
        [82, 58],
      ].map(([a, b], i) => (
        <motion.span
          key={i}
          animate={{ width: [a + "%", b + "%", a + "%"] }}
          transition={{ duration: 3.4, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
          style={{ width: a + "%" }}
          className={"h-1.5 rounded-full " + (i === 1 ? "bg-foreground/55" : "bg-surface-3")}
        />
      ))}
    </div>
  );
}

function MotionMark() {
    return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={
            i !== 1 ? {} : { scaleX: [1, 1.28, 1], opacity: [0.7, 1, 0.7] }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className={"h-6 origin-left rounded-md " + (i === 1 ? "w-9 bg-foreground/70" : "w-6 bg-surface-3")}
        />
      ))}
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="ml-0.5 border-y-[5px] border-l-[8px] border-y-transparent border-l-foreground/60"
      />
    </div>
  );
}

function MigrateMark() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-6 w-6 grid-cols-2 grid-rows-2 gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="rounded-[2px] bg-surface-3" />
        ))}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14m0 0-5-5m5 5-5 5" />
      </svg>
      <span className="relative h-6 w-6 rounded-md bg-foreground/70">
        <MigratingDot />
      </span>
    </div>
  );
}

/** The one tile forever in transit, left grid to right box. */
function MigratingDot() {
  return (
    <motion.span
      animate={{ x: [-46, 0], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.8, 1] }}
      className="absolute left-1.5 top-1.5 h-3 w-3 rounded-[3px] bg-background/80"
    />
  );
}

const AUDIENCE = [
  {
    who: "Designers",
    what: "Palettes, type, icons and imagery.",
    Mark: DesignerMark,
  },
  {
    who: "Developers",
    what: "Scripts, payloads and every network call.",
    Mark: DeveloperMark,
  },
  {
    who: "Video and motion",
    what: "Sources and posters a right click misses.",
    Mark: MotionMark,
  },
  {
    who: "Anyone migrating",
    what: "A whole site, in one pass.",
    Mark: MigrateMark,
  },
];

export function Audience() {
  return (
    <Section tone="raised">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <SectionHead
          eyebrow="Who it is for"
          title="Built for people who know what they are looking for."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.who} delay={i * 0.08}>
              <Card className="flex h-full flex-col p-6">
                <div className="mb-6 flex h-8 items-center">
                  <a.Mark />
                </div>
                <div className="mb-1.5 text-[16px] font-semibold">{a.who}</div>
                <p className="text-[14.5px] leading-relaxed text-muted-foreground">
                  {a.what}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
