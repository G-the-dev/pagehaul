"use client";

import { useEffect, useRef } from "react";

/**
 * The results coming apart into pixels.
 *
 * Drawn on one canvas over the whole window rather than as elements inside each
 * tile. The DOM version could not be made fine enough: every particle was a
 * span the browser had to style, lay out and composite, so a grid of tiles
 * could only afford about sixty each — which is why it read as squares
 * breaking off rather than something turning to dust. On a canvas the particle
 * count is limited by drawing, not by layout, and a few thousand is nothing.
 *
 * The images belong to other origins, which rules out the usual approach of
 * reading the pixels and emitting them. It does not rule this out: tainting
 * only blocks reading a canvas back, and we only ever draw. Each particle is a
 * drawImage of one small square of the original picture, so the fragments carry
 * the real image without a single pixel ever being read.
 */

/** Total particles across the whole screen, shared out between the tiles. */
const BUDGET = 7000;
/** Never coarser than this, or it looks like broken glass rather than dust. */
const MAX_CELL_PX = 14;
const MIN_CELL_PX = 5;

const DURATION = 1500;

interface Particle {
  /** Where in the source picture this fragment comes from. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Where it starts on screen. */
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  /** Seconds before this one lets go, so a tile comes apart rather than pops. */
  delay: number;
  life: number;
  spin: number;
}

function buildParticles(
  tile: Element,
  budgetPerTile: number,
): { src: CanvasImageSource; parts: Particle[] } | null {
  const media = tile.querySelector("img, video") as
    | HTMLImageElement
    | HTMLVideoElement
    | null;
  if (!media) return null;

  const natW =
    media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const natH =
    media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!natW || !natH) return null;

  const r = media.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;

  // Choose a cell size that spends roughly this tile's share of the budget.
  const ideal = Math.sqrt((r.width * r.height) / budgetPerTile);
  const cell = Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, ideal));
  const cols = Math.max(1, Math.round(r.width / cell));
  const rows = Math.max(1, Math.round(r.height / cell));

  const cw = r.width / cols;
  const ch = r.height / rows;
  // object-cover: the element shows a centre crop of the source.
  const scale = Math.max(r.width / natW, r.height / natH);
  const cropW = r.width / scale;
  const cropH = r.height / scale;
  const cropX = (natW - cropW) / 2;
  const cropY = (natH - cropH) / 2;

  const parts: Particle[] = [];
  const cx = r.left + r.width / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = r.left + col * cw;
      const y = r.top + row * ch;

      // Away from the middle and upward, with enough scatter that no two
      // fragments travel together.
      const fromCentre = (x + cw / 2 - cx) / (r.width / 2);
      const spread = 26 + Math.random() * 46;

      parts.push({
        sx: cropX + (col / cols) * cropW,
        sy: cropY + (row / rows) * cropH,
        sw: cropW / cols,
        sh: cropH / rows,
        x,
        y,
        // Overlap by a fraction so the tile looks whole for the first frames.
        w: cw + 0.6,
        h: ch + 0.6,
        vx: fromCentre * spread + (Math.random() - 0.5) * 34,
        vy: -34 - Math.random() * 78,
        // A soft diagonal so the tile comes apart from one corner.
        delay:
          (row / rows) * 0.1 +
          (1 - col / cols) * 0.06 +
          Math.random() * 0.22,
        life: 0.55 + Math.random() * 0.45,
        spin: (Math.random() - 0.5) * 2.4,
      });
    }
  }
  return { src: media, parts };
}

export function PixelDissolve({
  active,
  onDone,
}: {
  active: boolean;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const t = setTimeout(() => doneRef.current(), 200);
      return () => clearTimeout(t);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Only what is on screen. Everything below the fold is simply gone when
    // the animation ends, and nobody is looking at it.
    const tiles = Array.from(document.querySelectorAll("[data-tile]")).filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > -40 && r.top < vh + 40 && r.width > 0;
      },
    );
    if (!tiles.length) {
      const t = setTimeout(() => doneRef.current(), 120);
      return () => clearTimeout(t);
    }

    const groups = tiles
      .map((t) => buildParticles(t, BUDGET / tiles.length))
      .filter(Boolean) as { src: CanvasImageSource; parts: Particle[] }[];

    // Hide the originals only once there is something to replace them with.
    for (const t of tiles) (t as HTMLElement).style.visibility = "hidden";

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = (now - start) / 1000;
      ctx.clearRect(0, 0, vw, vh);

      let alive = false;
      for (const g of groups) {
        for (const p of g.parts) {
          const t = elapsed - p.delay;
          if (t <= 0) {
            // Still part of the picture, sitting where it started.
            ctx.globalAlpha = 1;
            ctx.drawImage(g.src, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.w, p.h);
            alive = true;
            continue;
          }
          const k = t / p.life;
          if (k >= 1) continue;
          alive = true;

          // Ease outward and let it drift up; the square shrinks as it fades so
          // the edges never look like tiles.
          const drift = 1 - Math.pow(1 - k, 2);
          const x = p.x + p.vx * drift;
          const y = p.y + p.vy * drift + 34 * k * k;
          const s = 1 - k * 0.75;

          ctx.globalAlpha = Math.max(0, 1 - k * k);
          if (p.spin) {
            ctx.save();
            ctx.translate(x + p.w / 2, y + p.h / 2);
            ctx.rotate(p.spin * k);
            ctx.drawImage(
              g.src,
              p.sx, p.sy, p.sw, p.sh,
              (-p.w * s) / 2, (-p.h * s) / 2, p.w * s, p.h * s,
            );
            ctx.restore();
          } else {
            ctx.drawImage(g.src, p.sx, p.sy, p.sw, p.sh, x, y, p.w * s, p.h * s);
          }
        }
      }
      ctx.globalAlpha = 1;

      if (alive && elapsed * 1000 < DURATION + 400) {
        raf = requestAnimationFrame(frame);
      } else {
        doneRef.current();
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      for (const t of tiles) (t as HTMLElement).style.visibility = "";
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}

/** How long the caller should wait before clearing the list. */
export const DISSOLVE_MS = DURATION + 300;
