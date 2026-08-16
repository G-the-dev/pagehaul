"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

/**
 * The GitHub button, before the repo is public.
 *
 * It keeps its place in the nav, but instead of opening a repository that is
 * not open yet, a tap drops a short note below it: the project will be open
 * source soon, and feedback is wanted meanwhile. Dismisses on a click away or
 * Escape, like any small popover.
 */
export function GithubNote() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full bg-foreground px-5 py-2 text-[13px] font-semibold text-background transition-opacity hover:opacity-90"
      >
        GitHub
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-surface-2 p-3.5 text-left shadow-lift"
          >
            <p className="text-[13px] font-medium text-foreground">
              Open source soon.
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              Got feedback or found a bug? Tell us what would make it better.
            </p>
            <a
              href="/contact"
              className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
            >
              Send feedback
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
