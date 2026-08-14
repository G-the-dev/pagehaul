"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** One easing curve for the whole site, so the page moves with one character. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ *
 * Cursor glow
 * ------------------------------------------------------------------ */

/**
 * A soft radial light that trails the pointer. Position is held in motion
 * values and spring smoothed, so tracking never triggers a React render.
 */
export function CursorGlow({
  size = 520,
  intensity = 0.06,
}: {
  size?: number;
  intensity?: number;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 180, damping: 28, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 180, damping: 28, mass: 0.35 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y, reduce]);

  const bg = useMotionTemplate`radial-gradient(${size}px circle at ${sx}px ${sy}px, rgba(255,255,255,${intensity}), transparent 70%)`;

  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30"
      style={{ background: bg }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Scroll reveal
 * ------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Reveals children one after another without hand tuning every delay. */
export function Stagger({
  children,
  gap = 0.08,
  className,
}: {
  children: ReactNode[];
  gap?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal key={i} delay={i * gap}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Card with a spotlight that tracks the pointer inside it
 * ------------------------------------------------------------------ */

export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(-200);
  const my = useMotionValue(-200);
  const [inside, setInside] = useState(false);

  const bg = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(255,255,255,0.09), transparent 72%)`;
  const ring = useMotionTemplate`radial-gradient(280px circle at ${mx}px ${my}px, rgba(255,255,255,0.32), transparent 70%)`;

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
      onPointerEnter={() => setInside(true)}
      onPointerLeave={() => setInside(false)}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-surface ${className}`}
    >
      {/* Border glow, drawn as a masked ring so only the edge lights up. */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: ring,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: 1,
          }}
        />
      )}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: bg }}
        />
      )}
      <div className="relative z-10">{children}</div>
      {inside && <span className="sr-only" />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Layout primitives
 * ------------------------------------------------------------------ */

/**
 * Every section goes through here, so vertical rhythm and measure are decided
 * once rather than re-guessed per section.
 */
export function Section({
  children,
  className = "",
  width = "default",
  tone = "base",
  id,
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
  tone?: "base" | "raised";
  id?: string;
}) {
  const max =
    width === "wide"
      ? "max-w-[1200px]"
      : width === "narrow"
        ? "max-w-3xl"
        : "max-w-6xl";

  return (
    <section
      id={id}
      className={`relative ${tone === "raised" ? "bg-surface/40" : ""} ${className}`}
    >
      <div className={`mx-auto ${max} px-6 py-24 sm:px-8 sm:py-32`}>{children}</div>
    </section>
  );
}

/** Eyebrow plus heading, so section openings are consistent everywhere. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className="mb-5 flex items-center gap-2.5">
        {align === "center" && <span className="h-px flex-1 bg-border sm:hidden" />}
        <span className="label-mono">{eyebrow}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      <h2 className="text-[2rem] font-medium leading-[1.12] tracking-tight sm:text-[2.75rem]">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 text-[15.5px] leading-relaxed text-muted-foreground">
          {lede}
        </p>
      )}
    </Reveal>
  );
}

export type { MotionValue };
