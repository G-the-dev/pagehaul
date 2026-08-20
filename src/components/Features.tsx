"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { EASE, Reveal, Section, SectionHead, Card } from "./ui/motion-primitives";

/* ------------------------------------------------------------------ *
 * Visuals. Each demonstrates its claim; none is decoration.
 * ------------------------------------------------------------------ */

const TILE = "rounded-md";

/** A page resolving into typed files. */
function CoverageVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const items = [
    { l: "WEBP", w: 2, tone: "bg-foreground/80" },
    { l: "SVG", w: 1, tone: "bg-surface-3" },
    { l: "MP4", w: 1, tone: "bg-surface-3" },
    { l: "WOFF2", w: 1, tone: "bg-surface-3" },
    { l: "JSON", w: 2, tone: "bg-surface-3" },
    { l: "PNG", w: 1, tone: "bg-foreground/45" },
    { l: "CSS", w: 1, tone: "bg-surface-3" },
    { l: "PDF", w: 1, tone: "bg-surface-3" },
  ];
  return (
    <div className="grid h-full grid-cols-4 content-center gap-2">
      {items.map((it, i) => (
        <motion.div
          key={it.l}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          animate={reduce || !active ? {} : { y: [0, -3, 0] }}
          transition={{ duration: 0.5, delay: i * 0.055, ease: EASE }}
          style={{ gridColumn: `span ${it.w}` }}
          className={`flex h-11 items-center justify-center ${TILE} ${it.tone}`}
        >
          <span
            className={`font-mono text-[10px] tracking-wider ${
              it.tone.includes("foreground/80")
                ? "text-background"
                : "text-muted-foreground"
            }`}
          >
            {it.l}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** One file leaving the set. */
function PrecisionVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid h-full grid-cols-3 content-center gap-2">
      {Array.from({ length: 9 }).map((_, i) => {
        const pick = i === 4;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.86 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            animate={
              reduce
                ? {}
                : pick
                  ? active
                    ? { y: -14, scale: 1.12 }
                    : { y: 0, scale: 1 }
                  : { opacity: active ? 0.28 : 1 }
            }
            transition={{ duration: 0.45, delay: i * 0.03, ease: EASE }}
            className={`relative h-12 ${TILE} ${
              pick ? "z-10 bg-foreground" : "bg-surface-2"
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

/** Colour and type, read off the page. */
function DesignVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const swatches = [
    { c: "#fafafa", n: "62%" },
    { c: "#a1a1a1", n: "21%" },
    { c: "#525252", n: "11%" },
    { c: "#262626", n: "6%" },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex gap-2">
        {swatches.map((s, i) => (
          <motion.div
            key={s.c}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            animate={reduce || !active ? {} : { y: [0, -5, 0] }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
            className={`flex-1 overflow-hidden ${TILE} border border-border`}
          >
            <div className="h-9 w-full" style={{ background: s.c }} />
            <div className="bg-surface-2 py-1 text-center font-mono text-[9.5px] text-muted-foreground">
              {s.n}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex items-baseline gap-3">
        {["Aa", "Aa", "Aa"].map((t, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.25 + i * 0.08, ease: EASE }}
            style={{ fontSize: `${28 - i * 8}px`, fontWeight: 700 - i * 200 }}
            className="leading-none text-fg-2"
          >
            {t}
          </motion.span>
        ))}
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="ml-auto font-mono text-[10.5px] text-muted-foreground"
        >
          3 families
        </motion.span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    tag: "Coverage",
    title: "Nothing stays hidden",
    body: "CSS backgrounds, every srcset size, fonts, video, API responses.",
    Visual: CoverageVisual,
  },
  {
    tag: "Precision",
    title: "One file, not the archive",
    body: "Click an asset, it downloads. Named properly, on its own.",
    Visual: PrecisionVisual,
  },
  {
    tag: "Design",
    title: "Read the design itself",
    body: "The palette a page paints with, its type, and its tokens.",
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

      <div className="mt-16 grid gap-5 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.1}>
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="h-full"
            >
              <Card className="flex h-full flex-col">
                <div className="p-6 pb-0">
                  <div className="h-[190px]">
                    <f.Visual active={hovered === i} />
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
    p: "Any public page. Choose quick, or deep for sites built with JavaScript.",
  },
  {
    n: "02",
    h: "See what it is made of",
    p: "Images, icons, video, fonts, documents and network calls, each named so you can read it.",
  },
  {
    n: "03",
    h: "Take what you need",
    p: "One file downloads on its own. Or pick a set and get an archive with a manifest.",
  },
];

/**
 * Step one: an address being typed, over and over.
 *
 * These loop rather than playing once on scroll, because the section is about
 * a process and a still frame does not read as one. All three are guarded by
 * reduced motion, where they settle on a finished state instead.
 */
function PasteVisual() {
  const reduce = useReducedMotion();
  const full = "stripe.com";
  const [typed, setTyped] = useState(reduce ? full : "");

  useEffect(() => {
    if (reduce) return;
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
  }, [reduce]);

  return (
    <div className="flex h-full items-center">
      <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-surface-3" />
        <span className="font-mono text-[12.5px] text-fg-2">{typed}</span>
        {!reduce && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="h-3.5 w-px bg-foreground"
          />
        )}
        <span className="ml-auto shrink-0 rounded-md bg-foreground px-2 py-1 text-[11px] font-semibold text-background">
          Scan
        </span>
      </div>
    </div>
  );
}

/** Step two: counts climbing as files are found. */
function FoundVisual() {
  const reduce = useReducedMotion();
  const rows = useMemo(
    () => [
      { k: "Images", n: 206 },
      { k: "Icons", n: 123 },
      { k: "Fonts", n: 9 },
    ],
    [],
  );
  const [counts, setCounts] = useState<number[]>(
    reduce ? rows.map((r) => r.n) : [0, 0, 0],
  );

  useEffect(() => {
    if (reduce) return;
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
  }, [reduce, rows]);

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
  const reduce = useReducedMotion();
  return (
    <div className="flex h-full items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => {
        const pick = i === 1;
        return (
          <motion.div
            key={i}
            animate={
              reduce
                ? {}
                : pick
                  ? { y: [0, -10, -10, 0] }
                  : { opacity: [1, 0.4, 0.4, 1] }
            }
            transition={
              reduce
                ? {}
                : {
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
      {["#fafafa", "#a1a1a1", "#525252", "#2e2e2e"].map((c) => (
        <span
          key={c}
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
      {[100, 62, 82].map((w, i) => (
        <span
          key={i}
          style={{ width: `${w}%` }}
          className={`h-1.5 rounded-full ${i === 1 ? "bg-foreground/55" : "bg-surface-3"}`}
        />
      ))}
    </div>
  );
}

function MotionMark() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-6 rounded-md ${i === 1 ? "w-9 bg-foreground/70" : "w-6 bg-surface-3"}`}
        />
      ))}
      <span className="ml-0.5 border-y-[5px] border-l-[8px] border-y-transparent border-l-foreground/60" />
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
      <span className="h-6 w-6 rounded-md bg-foreground/70" />
    </div>
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

        <div className="grid gap-4 sm:grid-cols-2">
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
