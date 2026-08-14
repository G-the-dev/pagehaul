"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
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
            className={`font-mono text-[9px] tracking-wider ${
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
            <div className="bg-surface-2 py-1 text-center font-mono text-[8.5px] text-muted-foreground">
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
          className="ml-auto font-mono text-[9.5px] text-muted-foreground"
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
                  <h3 className="mb-2 text-[16.5px] font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">
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

/** Step one: the thing you actually do, which is type an address. */
function PasteVisual() {
  return (
    <div className="flex h-full items-center">
      <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-surface-3" />
        <span className="font-mono text-[11.5px] text-fg-2">stripe.com</span>
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          className="h-3.5 w-px bg-foreground"
        />
        <span className="ml-auto rounded-md bg-foreground px-2 py-1 text-[10px] font-semibold text-background">
          Scan
        </span>
      </div>
    </div>
  );
}

/** Step two: what comes back, typed and counted. */
function FoundVisual() {
  const rows = [
    { k: "Images", n: 206 },
    { k: "Icons", n: 123 },
    { k: "Fonts", n: 9 },
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      {rows.map((r, i) => (
        <motion.div
          key={r.k}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: i * 0.1, ease: EASE }}
          className="flex items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-2"
        >
          <span className="h-5 w-5 shrink-0 rounded bg-surface-3" />
          <span className="text-[11.5px] text-fg-2">{r.k}</span>
          <span className="ml-auto font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {r.n}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** Step three: one file leaving, which is the whole point. */
function TakeVisual() {
  return (
    <div className="flex h-full items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.4, delay: i * 0.08, ease: EASE }}
          className={`h-14 flex-1 rounded-md ${
            i === 1 ? "relative bg-foreground" : "bg-surface-2"
          }`}
        >
          {i === 1 && (
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
      ))}
    </div>
  );
}

const STEP_VISUALS = [PasteVisual, FoundVisual, TakeVisual];

export function Steps() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, no account." />

      {/* Cards, matching every other section. The previous version drew a
          connector line that ran past the last step into empty space. */}
      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {STEPS.map((s, i) => {
          const Visual = STEP_VISUALS[i];
          return (
            <Reveal key={s.n} delay={i * 0.1}>
              <Card className="flex h-full flex-col">
                <div className="h-[104px] border-b border-border p-5">
                  <Visual />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                      {s.n}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="mb-2 text-[16px] font-semibold tracking-tight">
                    {s.h}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-muted-foreground">
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

const AUDIENCE = [
  { who: "Designers", what: "Palettes, type, icons and imagery." },
  { who: "Developers", what: "Scripts, payloads and every network call." },
  { who: "Video and motion", what: "Sources and posters a right click misses." },
  { who: "Anyone migrating", what: "A whole site, in one pass." },
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
              <Card className="h-full p-6">
                <div className="mb-2 text-[15px] font-semibold">{a.who}</div>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
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
