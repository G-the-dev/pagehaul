"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";

/**
 * The oversized wordmark, lit by the pointer.
 *
 * Three layers stacked in the same place, all showing the same word:
 *
 *   1. the mark itself, barely above the background, so it reads as embossed
 *      rather than printed
 *   2. a fixed sheen along the top edges, which is what makes it look like a
 *      surface catching ambient light rather than flat grey text
 *   3. a light that follows the pointer, clipped to the letterforms, so moving
 *      across it lights only the strokes it passes over
 *
 * Layer three is the effect. Clipping the gradient to the text with
 * background-clip means the light appears to be inside the letters, not drawn
 * over them.
 */
export function FooterWordmark({ text = "pagehaul" }: { text?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [lit, setLit] = useState(false);

  const mx = useMotionValue(-800);
  const my = useMotionValue(-400);
  // Light has weight. Without the spring it snaps and reads as a cursor.
  const sx = useSpring(mx, { stiffness: 260, damping: 34, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 260, damping: 34, mass: 0.4 });

  const glow = useMotionTemplate`radial-gradient(420px circle at ${sx}px ${sy}px, rgb(var(--glow) / 0.92), rgb(var(--glow) / 0.28) 32%, transparent 68%)`;

  const type =
    "text-center text-[clamp(3rem,15.5vw,13.5rem)] font-semibold tracking-[-0.055em] leading-[0.74] select-none";

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onPointerEnter={() => setLit(true)}
      onPointerLeave={() => setLit(false)}
      aria-hidden
      className="relative isolate"
    >
      {/* 1. the mark, only just visible */}
      <div className={`${type} text-foreground/[0.055]`}>{text}</div>

      {/* 2. a fixed sheen, so it has form before anyone touches it */}
      <div
        className={`pointer-events-none absolute inset-0 ${type} bg-clip-text text-transparent`}
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgb(var(--glow) / 0.16), rgb(var(--glow) / 0.02) 42%, transparent 72%)",
        }}
      >
        {text}
      </div>

      {/* 3. the pointer light, clipped to the strokes */}
      {!reduce && (
        <motion.div
          className={`pointer-events-none absolute inset-0 ${type} bg-clip-text text-transparent`}
          style={{ backgroundImage: glow }}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          {text}
        </motion.div>
      )}
    </div>
  );
}
