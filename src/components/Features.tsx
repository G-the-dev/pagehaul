"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

/**
 * Three claims, each with a small drawn visual that demonstrates the claim
 * rather than decorating it. The visuals animate once on scroll and again on
 * hover, so the page rewards attention without demanding it.
 */

const EASE = [0.2, 0.8, 0.2, 1] as const;

function Card({
  title,
  body,
  visual,
}: {
  title: string;
  body: string;
  visual: (active: boolean) => React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group"
    >
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface p-5">
        <div className="aspect-[4/3] w-full">{visual(hover)}</div>
      </div>
      <h3 className="mb-2 text-[17px] font-semibold tracking-tight">{title}</h3>
      <p className="text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </motion.div>
  );
}

/** Tiles filling a grid, the way results arrive during a scan. */
function GridVisual(active: boolean) {
  const cells = Array.from({ length: 12 });
  const reduce = useReducedMotion();
  return (
    <div className="grid h-full grid-cols-4 grid-rows-3 gap-1.5">
      {cells.map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.15, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          animate={
            reduce
              ? {}
              : active
                ? { opacity: [1, 0.35, 1], scale: [1, 0.94, 1] }
                : {}
          }
          transition={{
            duration: reduce ? 0 : 0.45,
            delay: (i % 4) * 0.045 + Math.floor(i / 4) * 0.05,
            ease: EASE,
          }}
          className={`rounded-md ${
            i === 5 || i === 6
              ? "bg-foreground/70"
              : i % 3 === 0
                ? "bg-surface-3"
                : "bg-surface-2"
          }`}
        />
      ))}
    </div>
  );
}

/** One tile lifting clear of the rest: take a single file, not the archive. */
function LiftVisual(active: boolean) {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid h-full grid-cols-3 grid-rows-3 gap-1.5">
      {Array.from({ length: 9 }).map((_, i) => {
        const isHero = i === 4;
        return (
          <motion.div
            key={i}
            animate={
              reduce
                ? {}
                : isHero
                  ? active
                    ? { y: -14, scale: 1.1, zIndex: 10 }
                    : { y: 0, scale: 1, zIndex: 10 }
                  : { opacity: active ? 0.35 : 1 }
            }
            transition={{ duration: 0.4, ease: EASE }}
            className={`relative rounded-md ${
              isHero
                ? "bg-foreground shadow-lift"
                : i % 2
                  ? "bg-surface-2"
                  : "bg-surface-3"
            }`}
          >
            {isHero && (
              <motion.span
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 grid place-items-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-background"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
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

/** Swatches resolving out of a page, the design read. */
function PaletteVisual(active: boolean) {
  const reduce = useReducedMotion();
  const bars = [92, 74, 58, 44, 30, 20];
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <div className="mb-auto flex gap-1.5">
        {["#fafafa", "#a1a1a1", "#525252", "#262626"].map((c, i) => (
          <motion.span
            key={c}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            animate={reduce ? {} : active ? { y: [0, -5, 0] } : {}}
            transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
            className="h-9 flex-1 rounded-md border border-border"
            style={{ background: c }}
          />
        ))}
      </div>
      {bars.map((w, i) => (
        <motion.span
          key={i}
          initial={{ width: 0 }}
          whileInView={{ width: `${w}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease: EASE }}
          className={`h-1.5 rounded-full ${i === 0 ? "bg-foreground/70" : "bg-surface-3"}`}
        />
      ))}
    </div>
  );
}

const FEATURES = [
  {
    title: "Nothing stays hidden",
    body: "Background images set in CSS, every size in a srcset, fonts buried in stylesheets, video sources, and files that only exist once JavaScript runs. All of it, listed in one place.",
    visual: GridVisual,
  },
  {
    title: "Take one file, not the archive",
    body: "Click a single asset and it downloads on its own, named properly. Choose a set and get a tidy archive with a manifest. You never unzip forty megabytes to find one logo.",
    visual: LiftVisual,
  },
  {
    title: "Read the design, not just the files",
    body: "The palette a page actually paints with, ranked by use. The fonts really rendering its text. The custom properties it declares, which is its design system verbatim.",
    visual: PaletteVisual,
  },
];

export function Features() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-16 max-w-lg"
        >
          <div className="label-mono mb-4">What you get</div>
          <h2 className="text-[1.9rem] font-medium leading-tight tracking-tight sm:text-[2.3rem]">
            A page is not one thing. It is a few hundred.
          </h2>
        </motion.div>

        <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
          {FEATURES.map((f) => (
            <Card key={f.title} title={f.title} body={f.body} visual={f.visual} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Plain statement of who this is for, kept short on purpose. */
export function Audience() {
  const rows = [
    ["Designers", "Palettes, type, icon sets and imagery, without asking anyone for the files."],
    ["Developers", "Scripts, JSON payloads and the network calls a page makes, without the DevTools dance."],
    ["Video and motion", "Source files and posters, including the ones a right click will never reach."],
    ["Anyone migrating", "Everything a site is built from, in one pass, ready to move."],
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="label-mono mb-4">Who it is for</div>
          <h2 className="mb-12 max-w-xl text-[1.9rem] font-medium leading-tight tracking-tight sm:text-[2.3rem]">
            Built for people who already know what they are looking for.
          </h2>
        </motion.div>

        <div className="divide-y divide-border border-y border-border">
          {rows.map(([who, what], i) => (
            <motion.div
              key={who}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              className="grid gap-2 py-5 sm:grid-cols-[180px_1fr] sm:gap-8"
            >
              <div className="text-[15px] font-medium">{who}</div>
              <div className="text-[14px] leading-relaxed text-muted-foreground">
                {what}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
