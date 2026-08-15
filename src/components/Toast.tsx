"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, TriangleAlert, X } from "lucide-react";

export type ToastTone = "done" | "partial" | "failed";

export interface ToastMessage {
  /** Changes on every new message, so repeating the same text still animates. */
  id: number;
  text: string;
  tone: ToastTone;
}

const ICON: Record<ToastTone, typeof Check> = {
  done: Check,
  partial: TriangleAlert,
  failed: TriangleAlert,
};

/** A result worth reading gets longer than a result worth glancing at. */
const LINGER: Record<ToastTone, number> = {
  done: 4200,
  partial: 7000,
  failed: 7000,
};

/**
 * Tells you what happened, away from the thing you clicked.
 *
 * The outcome of a download used to print inside the action bar, which pushed
 * the buttons around at the exact moment you might be reaching for them, and
 * left a stale sentence sitting there long after it stopped being true. A
 * notification arrives, is read, and leaves.
 *
 * It sits above the action bar rather than beside it, so it never covers the
 * controls it is reporting on.
 */
export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, LINGER[message.tone]);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  const Icon = message ? ICON[message.tone] : Check;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4"
    >
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            key={message.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border border-border bg-surface/95 py-3 pl-3.5 pr-2.5 shadow-lift backdrop-blur-xl"
          >
            <span
              className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                message.tone === "done"
                  ? "bg-accent text-accent-fg"
                  : "border border-accent-line text-warn"
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={3} />
            </span>

            <p className="pt-px text-[13px] leading-snug text-foreground">
              {message.text}
            </p>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
