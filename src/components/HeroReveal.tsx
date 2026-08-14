"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * A stand in web page with its assets called out. Hovering a region reveals
 * what that part of a page is actually made of, which is the whole product
 * argument made visually rather than in a paragraph.
 *
 * Everything here is drawn from primitives. No real site is reproduced.
 */

type Kind = "image" | "svg" | "video" | "font" | "api" | "doc";

interface Spot {
  id: string;
  kind: Kind;
  label: string;
  meta: string;
  /** Position and size as percentages of the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const SPOTS: Spot[] = [
  { id: "logo", kind: "svg", label: "logo.svg", meta: "vector · 2 KB", x: 4, y: 5.5, w: 15, h: 7 },
  { id: "hero", kind: "image", label: "hero@2x.webp", meta: "2400 × 1350 · 284 KB", x: 4, y: 19, w: 56, h: 30 },
  { id: "clip", kind: "video", label: "loop.mp4", meta: "0:12 · 1080p · 4.1 MB", x: 63, y: 19, w: 33, h: 30 },
  { id: "type", kind: "font", label: "Geist Variable", meta: "woff2 · 400 to 700", x: 4, y: 52, w: 34, h: 8 },
  { id: "cards", kind: "image", label: "3 product shots", meta: "webp · avg 96 KB", x: 4, y: 64, w: 92, h: 22 },
  { id: "net", kind: "api", label: "GET /api/catalog", meta: "200 · json · 14 KB", x: 63, y: 52, w: 33, h: 8 },
];

const KIND_STYLE: Record<Kind, string> = {
  image: "bg-white text-black",
  svg: "bg-white text-black",
  video: "bg-white text-black",
  font: "bg-white text-black",
  api: "bg-white text-black",
  doc: "bg-white text-black",
};

export function HeroReveal() {
  const [active, setActive] = useState<string | null>(null);
  const [auto, setAuto] = useState(0);
  const [hovering, setHovering] = useState(false);

  // Cycles on its own so the idea lands without requiring interaction.
  useEffect(() => {
    if (hovering) return;
    const t = setTimeout(() => setAuto((n) => (n + 1) % SPOTS.length), 2000);
    return () => clearTimeout(t);
  }, [auto, hovering]);

  const currentId = hovering ? active : SPOTS[auto].id;

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        onMouseLeave={() => {
          setHovering(false);
          setActive(null);
        }}
        onMouseEnter={() => setHovering(true)}
        className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-lift"
      >
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3.5 py-2.5">
          <span className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 rounded-full bg-surface-3" />
            ))}
          </span>
          <span className="ml-2 flex-1 truncate rounded-md bg-background/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            any-website.com
          </span>
          <span className="label-mono text-[9px]">scanning</span>
        </div>

        {/* the stand in page */}
        <div className="relative aspect-[16/10] w-full bg-background p-[3%]">
          <MockPage dimmed={currentId !== null} />

          {/* hotspots */}
          {SPOTS.map((s) => {
            const on = currentId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setActive(s.id)}
                aria-label={`${s.label}, ${s.meta}`}
                className="absolute rounded-md transition-all duration-300"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.w}%`,
                  height: `${s.h}%`,
                  outline: on ? "1.5px solid rgba(250,250,250,0.9)" : "1.5px solid transparent",
                  outlineOffset: "2px",
                  background: on ? "rgba(250,250,250,0.07)" : "transparent",
                }}
              >
                <AnimatePresence>
                  {on && (
                    <motion.span
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                      className={`pointer-events-none absolute -top-2 left-0 z-20 flex -translate-y-full items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 shadow-lift ${KIND_STYLE[s.kind]}`}
                    >
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-60">
                        {s.kind}
                      </span>
                      <span className="text-[11px] font-semibold">{s.label}</span>
                      <span className="font-mono text-[9.5px] opacity-55">{s.meta}</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-[12.5px] text-muted-foreground">
        {hovering
          ? "That is what pagehaul returns for every element on the page."
          : "Hover the page to see what each part is made of."}
      </p>
    </div>
  );
}

/** Simplified page furniture, drawn rather than screenshotted. */
function MockPage({ dimmed }: { dimmed: boolean }) {
  const dim = dimmed ? "opacity-45" : "opacity-100";
  return (
    <div className={`h-full w-full transition-opacity duration-500 ${dim}`}>
      {/* nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-3.5 rounded-[4px] bg-foreground/85" />
          <div className="h-2 w-14 rounded-full bg-foreground/70" />
        </div>
        <div className="flex gap-2.5">
          {[10, 8, 12, 7].map((w, i) => (
            <div key={i} style={{ width: `${w * 3}px` }} className="h-1.5 rounded-full bg-surface-3" />
          ))}
        </div>
      </div>

      {/* hero row */}
      <div className="mt-[4%] flex gap-[3%]">
        <div className="flex-1 overflow-hidden rounded-lg bg-gradient-to-br from-surface-3 via-surface-2 to-surface-3" />
        <div className="w-[35%] overflow-hidden rounded-lg bg-surface-2">
          <div className="grid h-full place-items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-foreground/15">
              <span className="ml-[2px] border-y-[5px] border-l-[8px] border-y-transparent border-l-foreground/70" />
            </div>
          </div>
        </div>
      </div>

      {/* copy + a data chip */}
      <div className="mt-[4%] flex items-start justify-between gap-[3%]">
        <div className="w-[38%] space-y-1.5">
          <div className="h-3 w-[85%] rounded-full bg-foreground/60" />
          <div className="h-2 w-[65%] rounded-full bg-surface-3" />
        </div>
        <div className="flex w-[35%] items-center gap-1.5 rounded-md border border-border px-2 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-foreground/50" />
          <div className="h-1.5 flex-1 rounded-full bg-surface-3" />
        </div>
      </div>

      {/* card row */}
      <div className="mt-[4%] grid grid-cols-3 gap-[2.5%]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border">
            <div className="aspect-[4/3] bg-gradient-to-br from-surface-2 to-surface-3" />
            <div className="space-y-1 p-2">
              <div className="h-1.5 w-[70%] rounded-full bg-surface-3" />
              <div className="h-1.5 w-[45%] rounded-full bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
