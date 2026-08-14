"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { EASE } from "./ui/motion-primitives";

/**
 * The hero background is a stand in web page. A light follows the pointer and
 * whatever it passes over is identified: the banner as a sized webp, the loop
 * as an mp4, the type as a woff2, a request as json. The product argument is
 * the background rather than a diagram beside it.
 *
 * Everything is drawn from primitives. No real site is reproduced.
 */

type Kind = "image" | "svg" | "video" | "font" | "api" | "doc";

interface Spot {
  id: string;
  kind: Kind;
  label: string;
  meta: string;
  /** Percentages of the backdrop box. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const SPOTS: Spot[] = [
  { id: "logo", kind: "svg", label: "logo.svg", meta: "vector · 2 KB", x: 6, y: 8, w: 13, h: 6 },
  { id: "hero", kind: "image", label: "hero@2x.webp", meta: "2400 × 1350 · 284 KB", x: 6, y: 21, w: 52, h: 26 },
  { id: "clip", kind: "video", label: "loop.mp4", meta: "0:12 · 1080p · 4.1 MB", x: 62, y: 21, w: 32, h: 26 },
  { id: "type", kind: "font", label: "Geist Variable", meta: "woff2 · 400 to 700", x: 6, y: 52, w: 30, h: 7 },
  { id: "net", kind: "api", label: "GET /api/catalog", meta: "200 · json · 14 KB", x: 62, y: 52, w: 32, h: 7 },
  { id: "cards", kind: "image", label: "3 product shots", meta: "webp · avg 96 KB", x: 6, y: 65, w: 88, h: 24 },
];

const LIGHT = 420;

export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Pointer position drives the light through motion values, so movement never
  // re-renders. Only a change of active region touches state.
  const px = useMotionValue(-9999);
  const py = useMotionValue(-9999);
  const sx = useSpring(px, { stiffness: 220, damping: 30, mass: 0.3 });
  const sy = useSpring(py, { stiffness: 220, damping: 30, mass: 0.3 });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [autoIdx, setAutoIdx] = useState(0);

  // Without a pointer the demo runs itself, so the idea lands regardless.
  useEffect(() => {
    if (engaged || reduce) return;
    const t = setTimeout(() => setAutoIdx((n) => (n + 1) % SPOTS.length), 2400);
    return () => clearTimeout(t);
  }, [autoIdx, engaged, reduce]);

  useEffect(() => {
    if (engaged || reduce) return;
    const s = SPOTS[autoIdx];
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    px.set(((s.x + s.w / 2) / 100) * r.width);
    py.set(((s.y + s.h / 2) / 100) * r.height);
    setActiveId(s.id);
  }, [autoIdx, engaged, reduce, px, py]);

  function onMove(e: React.PointerEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const lx = e.clientX - r.left;
    const ly = e.clientY - r.top;
    px.set(lx);
    py.set(ly);
    setEngaged(true);

    // Nearest region whose box contains the pointer, else nothing.
    const fx = (lx / r.width) * 100;
    const fy = (ly / r.height) * 100;
    const hit = SPOTS.find(
      (s) => fx >= s.x && fx <= s.x + s.w && fy >= s.y && fy <= s.y + s.h,
    );
    setActiveId((prev) => (hit?.id ?? null) === prev ? prev : (hit?.id ?? null));
  }

  // The light itself, and a mask that lifts the page art only where it falls.
  const glow = useMotionTemplate`radial-gradient(${LIGHT}px circle at ${sx}px ${sy}px, rgba(255,255,255,0.13), rgba(255,255,255,0.04) 40%, transparent 68%)`;
  const revealMask = useMotionTemplate`radial-gradient(${LIGHT * 0.9}px circle at ${sx}px ${sy}px, #000 15%, transparent 70%)`;

  return (
    <div
      ref={ref}
      onPointerMove={reduce ? undefined : onMove}
      onPointerLeave={() => {
        setEngaged(false);
        setActiveId(null);
      }}
      className="absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {/* Base art, held well back so headline contrast is never at risk. */}
      <div className="absolute inset-0 opacity-[0.16]">
        <MockPage />
      </div>

      {/* The same art again, revealed only under the light. */}
      {!reduce && (
        <motion.div
          className="absolute inset-0 opacity-70"
          style={{
            WebkitMaskImage: revealMask,
            maskImage: revealMask,
          }}
        >
          <MockPage />
        </motion.div>
      )}

      {!reduce && (
        <motion.div className="absolute inset-0" style={{ background: glow }} />
      )}

      {/* Region outlines and their callouts. */}
      {SPOTS.map((s) => {
        const on = activeId === s.id;
        return (
          <div
            key={s.id}
            className="absolute"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
          >
            <motion.div
              className="absolute inset-0 rounded-lg border"
              animate={{
                opacity: on ? 1 : 0,
                borderColor: on ? "rgba(250,250,250,0.55)" : "rgba(250,250,250,0)",
                scale: on ? 1 : 0.985,
              }}
              transition={{ duration: 0.35, ease: EASE }}
            />
            <AnimatePresence>
              {on && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="absolute -top-2.5 left-0 z-20 flex -translate-y-full items-center gap-2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-background shadow-lift"
                >
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] opacity-55">
                    {s.kind}
                  </span>
                  <span className="text-[12px] font-semibold">{s.label}</span>
                  <span className="font-mono text-[10px] opacity-55">{s.meta}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/** Simplified page furniture, drawn rather than captured. */
function MockPage() {
  return (
    <div className="h-full w-full px-[5%] py-[6%]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-[5px] bg-foreground/80" />
          <div className="h-2.5 w-20 rounded-full bg-foreground/60" />
        </div>
        <div className="flex gap-4">
          {[34, 26, 40, 22].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-2 rounded-full bg-foreground/25" />
          ))}
        </div>
      </div>

      <div className="mt-[3.5%] flex gap-[4%]">
        <div className="h-[26vh] flex-1 rounded-xl bg-gradient-to-br from-foreground/22 via-foreground/10 to-foreground/20" />
        <div className="grid h-[26vh] w-[34%] place-items-center rounded-xl bg-foreground/12">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-foreground/25">
            <span className="ml-[3px] border-y-[8px] border-l-[13px] border-y-transparent border-l-foreground/80" />
          </div>
        </div>
      </div>

      <div className="mt-[3.5%] flex items-start justify-between gap-[4%]">
        <div className="w-[34%] space-y-2.5">
          <div className="h-4 w-[90%] rounded-full bg-foreground/50" />
          <div className="h-2.5 w-[62%] rounded-full bg-foreground/22" />
        </div>
        <div className="flex w-[34%] items-center gap-2 rounded-lg border border-foreground/20 px-3 py-2.5">
          <div className="h-2 w-2 rounded-full bg-foreground/45" />
          <div className="h-2 flex-1 rounded-full bg-foreground/20" />
        </div>
      </div>

      <div className="mt-[3.5%] grid grid-cols-3 gap-[3%]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-foreground/12">
            <div className="aspect-[16/10] bg-gradient-to-br from-foreground/16 to-foreground/8" />
            <div className="space-y-2 p-3">
              <div className="h-2 w-[68%] rounded-full bg-foreground/22" />
              <div className="h-2 w-[44%] rounded-full bg-foreground/14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
