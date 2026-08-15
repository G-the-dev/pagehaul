"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Scatters a tile into pixels and lets them drift away.
 *
 * The obvious way to do this is a canvas: draw the image, read the pixels,
 * emit particles. It cannot work here. Every picture we show belongs to
 * somebody else's origin, so drawing it taints the canvas and reading it back
 * throws a security error.
 *
 * So the particles are made of CSS instead. The tile is covered with a grid of
 * small cells, each one showing its own part of the picture through
 * background-position, and each drifts off on its own path. Nothing is ever
 * read back, so the browser has no objection and any image works.
 *
 * Cells are deliberately few. A grid of two hundred tiles dissolving at eleven
 * by eight cells each is eighteen thousand animated elements, which is how you
 * turn a nice moment into a locked-up tab. Only what is on screen dissolves;
 * everything else simply fades.
 */

const COLS = 9;
const ROWS = 7;

/**
 * Deterministic jitter. Math.random would give a different scatter on every
 * render, so a cell would jump the moment React re-rendered mid-animation.
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Most cells a single tile may shed at once, before it becomes a cost. */
const MAX_SHED = 6;

export function Dissolve({
  active,
  shedding = 0,
  src,
  seed = 0,
  children,
}: {
  active: boolean;
  /**
   * How hard the tile is evaporating, 0 to 1, before the end.
   *
   * The point is a warning you feel rather than read, so the tile itself never
   * fades and never stops responding — it just starts giving off pixels, more
   * of them as the time goes. Somebody still downloading in the last seconds
   * can carry on doing it.
   */
  shedding?: number;
  /** The picture to shatter. Without one the cells carry the tile's own tint. */
  src?: string;
  seed?: number;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  // Only tiles the eye can actually see earn particles.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cells = useMemo(() => {
    if (!active || reduce || !onScreen) return [];
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const n1 = noise(seed + i);
        const n2 = noise(seed + i + 977);
        out.push({
          key: i,
          left: `${(c / COLS) * 100}%`,
          top: `${(r / ROWS) * 100}%`,
          // Cells overlap by a hair so no seams show before they separate.
          width: `${100 / COLS + 0.4}%`,
          height: `${100 / ROWS + 0.4}%`,
          posX: `${(c / (COLS - 1)) * 100}%`,
          posY: `${(r / (ROWS - 1)) * 100}%`,
          // Drift up and outward from the middle, the way smoke leaves.
          dx: (c - (COLS - 1) / 2) * 5 + (n1 - 0.5) * 44,
          dy: -18 - n2 * 52,
          rotate: (n1 - 0.5) * 70,
          // Cells leave in waves from the bottom up rather than all at once.
          delay: (1 - r / ROWS) * 0.22 + n2 * 0.16,
        });
      }
    }
    return out;
  }, [active, reduce, onScreen, seed]);

  const dissolving = active && cells.length > 0;

  // A few cells lifting off and drifting away, over and over, while the tile
  // underneath carries on as normal. Positions come from the same deterministic
  // noise so they do not jump between renders.
  const shed = useMemo(() => {
    if (active || reduce || !onScreen || shedding <= 0) return [];
    const count = Math.max(1, Math.round(shedding * MAX_SHED));
    return Array.from({ length: count }, (_, i) => {
      const a = noise(seed + i * 31 + 7);
      const b = noise(seed + i * 31 + 401);
      const col = Math.floor(a * COLS);
      const row = Math.floor(b * ROWS);
      return {
        key: i,
        left: `${(col / COLS) * 100}%`,
        top: `${(row / ROWS) * 100}%`,
        width: `${100 / COLS}%`,
        height: `${100 / ROWS}%`,
        posX: `${(col / (COLS - 1)) * 100}%`,
        posY: `${(row / (ROWS - 1)) * 100}%`,
        dx: (a - 0.5) * 26,
        // Faster and further as the end approaches.
        dy: -22 - shedding * 30,
        duration: 2.4 - shedding * 0.9,
        delay: b * 2.2,
      };
    });
  }, [active, reduce, onScreen, shedding, seed]);

  return (
    <div ref={ref} className="relative">
      {/* The tile itself goes first, quickly, so the particles are what you
          watch rather than a ghost of the original underneath them. */}
      <motion.div
        animate={{ opacity: active ? 0 : 1 }}
        transition={{ duration: dissolving ? 0.22 : 0.5, ease: "easeOut" }}
      >
        {children}
      </motion.div>

      {shed.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {shed.map((cell) => (
            <motion.span
              key={cell.key}
              className="absolute rounded-[1px]"
              style={{
                left: cell.left,
                top: cell.top,
                width: cell.width,
                height: cell.height,
                backgroundImage: src ? `url(${src})` : undefined,
                backgroundColor: src ? undefined : "rgb(var(--raise) / 0.4)",
                backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
                backgroundPosition: `${cell.posX} ${cell.posY}`,
              }}
              initial={{ opacity: 0, y: 0, scale: 1 }}
              animate={{ opacity: [0, 0.75, 0], y: cell.dy, scale: 0.3 }}
              transition={{
                duration: cell.duration,
                delay: cell.delay,
                repeat: Infinity,
                repeatDelay: 0.8,
                ease: "easeOut",
                times: [0, 0.25, 1],
              }}
            />
          ))}
        </div>
      )}

      {dissolving && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {cells.map((cell) => (
            <motion.span
              key={cell.key}
              className="absolute rounded-[1px]"
              style={{
                left: cell.left,
                top: cell.top,
                width: cell.width,
                height: cell.height,
                backgroundImage: src ? `url(${src})` : undefined,
                backgroundColor: src ? undefined : "rgb(var(--raise) / 0.5)",
                backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
                backgroundPosition: `${cell.posX} ${cell.posY}`,
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
              animate={{
                opacity: 0,
                x: cell.dx,
                y: cell.dy,
                scale: 0.25,
                rotate: cell.rotate,
              }}
              transition={{
                duration: 1.05,
                delay: cell.delay,
                ease: [0.2, 0.6, 0.3, 1],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** How long to wait before the results can be cleared, in milliseconds. */
export const DISSOLVE_MS = 1500;
