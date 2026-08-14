"use client";

import { motion } from "framer-motion";
import { EASE } from "./ui/motion-primitives";

/**
 * Visitors stall at an empty input because nothing shows what a valid target
 * looks like. Small chips, one click each, so the first result costs nothing.
 */
const EXAMPLES = ["stripe.com", "linear.app", "vercel.com", "framer.com", "figma.com"];

export function TryExamples({
  onPick,
  disabled,
}: {
  onPick: (host: string) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.32, ease: EASE }}
      className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <span className="mr-1 text-[12.5px] text-muted-foreground">Try</span>
      {EXAMPLES.map((host, i) => (
        <motion.button
          key={host}
          type="button"
          disabled={disabled}
          onClick={() => onPick(host)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.38 + i * 0.05, ease: EASE }}
          className="rounded-full border border-border bg-surface/70 px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground backdrop-blur-md transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
        >
          {host}
        </motion.button>
      ))}
    </motion.div>
  );
}
