"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
  EASE,
  Reveal,
  Section,
  SectionHead,
  SpotlightCard,
} from "./ui/motion-primitives";

/* ------------------------------------------------------------------ *
 * Visuals. Each one demonstrates its own claim rather than decorating.
 * ------------------------------------------------------------------ */

/** Tiles arriving the way results arrive during a scan. */
function GridVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid h-full grid-cols-4 grid-rows-3 gap-2">
      {Array.from({ length: 12 }).map((_, i) => {
        const marked = i === 5 || i === 6;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            animate={
              reduce || !active
                ? {}
                : { y: [0, -4, 0], transition: { duration: 0.5, delay: i * 0.03, ease: EASE } }
            }
            transition={{
              duration: 0.5,
              delay: 0.05 + (i % 4) * 0.05 + Math.floor(i / 4) * 0.07,
              ease: EASE,
            }}
            className={`rounded-lg ${
              marked ? "bg-foreground/85" : i % 3 === 0 ? "bg-surface-3" : "bg-surface-2"
            }`}
          />
        );
      })}
    </div>
  );
}

/** One tile lifting clear of the rest. */
function LiftVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid h-full grid-cols-3 grid-rows-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => {
        const hero = i === 4;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            animate={
              reduce
                ? {}
                : hero
                  ? active
                    ? { y: -16, scale: 1.14 }
                    : { y: 0, scale: 1 }
                  : { opacity: active ? 0.3 : 1, scale: 1 }
            }
            transition={{ duration: 0.45, delay: i * 0.03, ease: EASE }}
            className={`relative rounded-lg ${
              hero ? "z-10 bg-foreground shadow-lift" : i % 2 ? "bg-surface-2" : "bg-surface-3"
            }`}
          >
            {hero && (
              <motion.span
                animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.7 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute inset-0 grid place-items-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-background"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />
                </svg>
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** Swatches resolving, then the type scale drawing out. */
function PaletteVisual({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const swatches = ["#fafafa", "#a1a1a1", "#525252", "#262626"];
  const bars = [94, 76, 60, 46, 32];
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        {swatches.map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            animate={reduce || !active ? {} : { y: [0, -6, 0] }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: EASE }}
            className="h-11 flex-1 rounded-lg border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {bars.map((w, i) => (
          <motion.span
            key={i}
            initial={{ width: 0, opacity: 0 }}
            whileInView={{ width: `${w}%`, opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: EASE }}
            className={`h-2 rounded-full ${i === 0 ? "bg-foreground/75" : "bg-surface-3"}`}
          />
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    tag: "Coverage",
    title: "Nothing stays hidden",
    body: "Background images set in CSS. Every size in a srcset. Fonts buried in stylesheets. Files that only exist once JavaScript runs. All of it, in one grid.",
    Visual: GridVisual,
  },
  {
    tag: "Precision",
    title: "One file, not the archive",
    body: "Click a single asset and it downloads on its own, named properly. Choose a set and get a tidy archive with a manifest. You never unzip forty megabytes to find one logo.",
    Visual: LiftVisual,
  },
  {
    tag: "Design",
    title: "Read the design, not just the files",
    body: "The palette a page actually paints with, ranked by use. The fonts really rendering its text. The custom properties it declares, which is its design system verbatim.",
    Visual: PaletteVisual,
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
        lede="Most of what a site is made of never appears in a right click menu. pagehaul lists every part of it, then lets you take only the pieces you came for."
      />

      <div className="mt-16 grid gap-5 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.1}>
            <div
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="h-full"
            >
              <SpotlightCard className="flex h-full flex-col">
                <div className="border-b border-border p-6">
                  <div className="aspect-[5/4]">
                    <f.Visual active={hovered === i} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="label-mono mb-3">{f.tag}</div>
                  <h3 className="mb-2.5 text-[17px] font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </SpotlightCard>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * Steps, as a connected sequence rather than three floating columns.
 * ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    h: "Paste a link",
    p: "Any public page. Quick reads the markup and stylesheets. Deep runs the page in a real browser and records every file it requests.",
  },
  {
    n: "02",
    h: "See what it is built from",
    p: "Images, icons, video, fonts, documents, scripts and the network calls the page makes, sorted into one grid with names you can read.",
  },
  {
    n: "03",
    h: "Take what you need",
    p: "Click one file and it downloads. Choose a set and get a tidy archive with a manifest. Nothing to unzip and search through.",
  },
];

export function Steps() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, no account." />

      <div className="relative mt-16">
        {/* The line that makes it a sequence instead of three columns. */}
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1.1, ease: EASE }}
          className="absolute left-0 right-0 top-[26px] hidden h-px origin-left bg-gradient-to-r from-border via-border to-transparent lg:block"
        />

        <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="relative">
                <div className="mb-6 flex items-center gap-3">
                  <span className="relative z-10 grid h-[52px] w-[52px] place-items-center rounded-xl border border-border bg-surface font-mono text-[13px] font-semibold">
                    {s.n}
                  </span>
                </div>
                <h3 className="mb-2.5 text-[17px] font-semibold tracking-tight">{s.h}</h3>
                <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
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
  {
    who: "Designers",
    what: "Palettes, type scales, icon sets and imagery, without asking anyone for the source files.",
  },
  {
    who: "Developers",
    what: "Scripts, JSON payloads and every network call a page makes, without living in the Network tab.",
  },
  {
    who: "Video and motion",
    what: "Source files, posters and captions, including the ones a right click will never reach.",
  },
  {
    who: "Anyone migrating",
    what: "Everything a site is built from, in a single pass, ready to move somewhere else.",
  },
];

export function Audience() {
  return (
    <Section tone="raised">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <SectionHead
          eyebrow="Who it is for"
          title="Built for people who already know what they are looking for."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.who} delay={i * 0.08}>
              <SpotlightCard className="h-full p-6">
                <div className="mb-2.5 text-[15px] font-semibold">{a.who}</div>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                  {a.what}
                </p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
