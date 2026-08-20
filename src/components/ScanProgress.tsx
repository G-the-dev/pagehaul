"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "./ui/motion-primitives";

/**
 * One row, not a panel of ticked-off steps. The current stage rises into place
 * as the previous one leaves, so the whole thing stays a single line of text
 * that keeps moving. A list of completed steps is noise once they are done.
 */

const STAGES = [
  "Checking the address is safe to fetch",
  "Opening the page in a browser",
  "Scrolling to trigger lazy images",
  "Reading stylesheets and fonts",
  "Recording every file the page requests",
  "Sorting and naming what was found",
];

/**
 * What the line says once the scripted stages run out.
 *
 * The stages cover a normal scan; a heavy site runs past them, and the old
 * behaviour was to freeze on the last one — which after forty seconds of the
 * same sentence reads as "stuck", not "working". These pick up from the
 * elapsed clock and keep the line moving with the truth: the page is big,
 * everything found is yours, sit tight.
 */
const PATIENCE: [number, string][] = [
  [16, "This page has a lot on it, still reading"],
  [28, "It's a big one. More files usually means a little more wait"],
  [42, "Still going. Everything it finds is yours in a moment"],
  [58, "Taking a second pass so nothing gets missed"],
  [75, "Nearly there now"],
];

export function ScanProgress({
  deep,
  onCancel,
}: {
  deep: boolean;
  /** Stops the scan. A deep scan can run the better part of a minute, and a
   *  mistyped address should not have to be waited out. */
  onCancel?: () => void;
}) {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Quick scans finish before most of these stages would show, so it steps
  // faster and skips the browser-specific ones.
  const stages = deep ? STAGES : [STAGES[0], STAGES[3], STAGES[4], STAGES[5]];
  const step = deep ? 2600 : 900;

  useEffect(() => {
    const t = setInterval(
      () => setI((n) => (n + 1 < stages.length ? n + 1 : n)),
      step,
    );
    return () => clearInterval(t);
  }, [stages.length, step]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // The scripted line while it lasts, then whichever reassurance the clock
  // has reached.
  let label = stages[i];
  for (const [at, msg] of PATIENCE) {
    if (elapsed >= at) label = msg;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-lg">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/70 px-4 py-3 backdrop-blur-md">
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-muted-foreground border-t-transparent" />

        {/* Fixed height, so the row never changes size as text swaps. */}
        <div className="relative h-5 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={label}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.42, ease: EASE }}
              className="absolute inset-0 truncate text-left text-[13.5px] text-fg-2"
            >
              {label}
            </motion.p>
          </AnimatePresence>
        </div>

        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {elapsed}s
        </span>

        {onCancel && (
          <>
            <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* A deep scan runs half a minute, and an empty page invites leaving. A
          quiet nudge to look around keeps someone here — and points them at the
          sections that explain what they are about to get. */}
      <motion.button
        type="button"
        onClick={() =>
          document
            .getElementById("what")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="group mx-auto mt-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        While this runs, see what it finds
        <motion.span
          aria-hidden
          animate={{ y: [0, 3, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="text-foreground/70 group-hover:text-foreground"
        >
          ↓
        </motion.span>
      </motion.button>
    </div>
  );
}
