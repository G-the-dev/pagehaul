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
  scoped = false,
}: {
  size?: number;
  intensity?: number;
  /** Confine the light to the nearest positioned ancestor. */
  scoped?: boolean;
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

  const bg = useMotionTemplate`radial-gradient(${size}px circle at ${sx}px ${sy}px, rgb(var(--glow) / ${intensity}), transparent 70%)`;

  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none ${scoped ? "absolute" : "fixed"} inset-0 z-30`}
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

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-300 hover:border-border-strong ${className}`}
    >
      {children}
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
  /** Retained for call sites. Section tinting was removed; see the note above. */
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
    // defer-paint lets the browser skip styling and painting a section it
    // cannot see. Every one of these sits below the fold on arrival.
    <section id={id} className={`defer-paint relative ${className}`}>
      {/* Roomy on a desktop, tighter on a phone — 112px of air between
          sections read as emptiness on a screen four sections tall. */}
      <div className={`relative mx-auto ${max} px-6 py-16 sm:px-8 sm:py-36`}>
        {children}
      </div>
    </section>
  );
}

/** The single eyebrow treatment. Every section opens with one of these. */
export function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </span>
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
      <Chip className="mb-6">{eyebrow}</Chip>
      <h2 className="text-[2.15rem] font-medium leading-[1.12] tracking-tight sm:text-[3rem]">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 text-[16.5px] leading-relaxed text-muted-foreground">
          {lede}
        </p>
      )}
    </Reveal>
  );
}

export type { MotionValue };
