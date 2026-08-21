"use client";

import { useEffect, useRef } from "react";

/**
 * The brand, as weather: a field of tiny square dots, clustered like the
 * tile logo, a few of them breathing. Drawn on one canvas because a DOM of
 * thousands of dots would cost more than the whole page around it.
 *
 * Density comes from two layers of hashed noise, coarse clusters over fine
 * speckle, so the field has structure instead of static. The animation
 * budget is deliberately small: a slow sine per visible dot, ten frames a
 * second, and none at all for people who asked their OS for less motion.
 */

const CELL = 7;
const DOT = 2;
const FPS = 10;

/** Deterministic hash to [0,1) so the field is stable across redraws. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export function DotMatrix({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      // The current theme's ink, read live so a theme flip repaints right.
      ctx.fillStyle = getComputedStyle(canvas).color;
      const cols = Math.ceil(w / CELL);
      const rows = Math.ceil(h / CELL);
      for (let iy = 0; iy < rows; iy++) {
        for (let ix = 0; ix < cols; ix++) {
          const fine = hash(ix, iy);
          const coarse = hash(ix >> 2, iy >> 2);
          const v = fine * 0.55 + coarse * 0.45;
          if (v < 0.57) continue;
          let a = ((v - 0.57) / 0.43) * 0.62;
          if (!still) {
            const phase = hash(iy, ix) * Math.PI * 2;
            a *= 0.65 + 0.35 * Math.sin(t / 1400 + phase * 3);
          }
          ctx.globalAlpha = Math.max(0, a);
          ctx.fillRect(ix * CELL, iy * CELL, DOT, DOT);
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / FPS) return;
      last = t;
      draw(t);
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.ceil(rect.width);
      canvas.height = Math.ceil(rect.height);
      draw(performance.now());
    };

    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    fit();
    if (!still) raf = requestAnimationFrame(tick);

    // Theme flips swap the ink; repaint rather than fade the old colour in.
    const mo = new MutationObserver(() => draw(performance.now()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none text-foreground ${className ?? ""}`}
    />
  );
}
