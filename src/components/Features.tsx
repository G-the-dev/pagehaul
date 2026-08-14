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
  { n: "01", h: "Paste a link", p: "Any public page. Quick or deep." },
  { n: "02", h: "See what it is built from", p: "Every file, sorted, with real names." },
  { n: "03", h: "Take what you need", p: "One file, or a tidy archive." },
];

export function Steps() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, no account." />

      <div className="relative mt-16">
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.1, ease: EASE }}
          className="absolute left-0 right-0 top-[25px] hidden h-px origin-left bg-gradient-to-r from-border via-border to-transparent lg:block"
        />

        <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="relative">
                <span className="relative z-10 mb-7 grid h-[50px] w-[50px] place-items-center rounded-xl border border-border bg-surface font-mono text-[12.5px] font-semibold">
                  {s.n}
                </span>
                <h3 className="mb-2 text-[16.5px] font-semibold tracking-tight">
                  {s.h}
                </h3>
                <p className="max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
                  {s.p}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
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
