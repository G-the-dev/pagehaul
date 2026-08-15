"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A tooltip we can actually style.
 *
 * The title attribute hands the job to the operating system, which draws a
 * square grey box in its own font with its own timing and ignores every token
 * on the page. This is the same information in the page's own language.
 *
 * It renders into the body rather than beside the trigger, because a tile is a
 * rounded card with overflow hidden and anything positioned inside it would be
 * clipped at the edge.
 */

/** Long enough that scanning a grid does not set off a trail of tooltips. */
const OPEN_DELAY_MS = 420;
const GAP = 8;

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setAt(null);
  }, []);

  const open = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      // Above by default; below when there is no room, so it never sits
      // half off the top of the window.
      const below = r.top < 56;
      setAt({
        x: r.left + r.width / 2,
        y: below ? r.bottom + GAP : r.top - GAP,
        below,
      });
    }, OPEN_DELAY_MS);
  }, []);

  // Anything that moves the trigger invalidates the position, and re-measuring
  // on every scroll frame is not worth it for a hover hint.
  useEffect(() => {
    if (!at) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [at, close]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <>
      <span
        ref={ref}
        /* inline-flex, not the default inline. An inline box wrapping a block
           child measures as a collapsed sliver at the start of the line, which
           put the bubble a hundred pixels off the left of the window. */
        className={`inline-flex ${className ?? ""}`}
        aria-describedby={at ? id : undefined}
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
      >
        {children}
      </span>

      {at &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            /* Nudged back inside the window once its real width is known. A
               tile in the first column would otherwise centre its bubble half
               off the edge. */
            ref={(el) => {
              if (!el) return;
              const r = el.getBoundingClientRect();
              const overLeft = GAP - r.left;
              const overRight = r.right - (window.innerWidth - GAP);
              const shift = overLeft > 0 ? overLeft : overRight > 0 ? -overRight : 0;
              el.style.marginLeft = shift ? `${shift}px` : "";
            }}
            className="pointer-events-none fixed z-[70] max-w-xs rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[12.5px] leading-snug text-foreground shadow-lift"
            style={{
              left: at.x,
              top: at.y,
              transform: at.below
                ? "translate(-50%, 0)"
                : "translate(-50%, -100%)",
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
