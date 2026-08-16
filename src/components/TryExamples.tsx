"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { EASE } from "./ui/motion-primitives";
import type { Recent } from "@/lib/recent";

/**
 * Recently scanned addresses, or a set of examples before there are any.
 *
 * A first-time visitor stalls at an empty input, so a few example chips show
 * what a valid target looks like. Once they have scanned something, the same
 * row becomes their own history — one click to run it again — kept across
 * refreshes in their browser.
 */
const EXAMPLES = ["stripe.com", "linear.app", "vercel.com", "framer.com", "figma.com"];

export function TryExamples({
  onPick,
  recent,
  onRemove,
  disabled,
}: {
  onPick: (host: string) => void;
  recent: Recent[];
  onRemove: (url: string) => void;
  disabled?: boolean;
}) {
  const hasHistory = recent.length > 0;
  const items = hasHistory
    ? recent
    : EXAMPLES.map((h) => ({ url: h, label: h }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.32, ease: EASE }}
      className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <span className="mr-1 text-[12.5px] text-muted-foreground">
        {hasHistory ? "Recent" : "Try"}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={item.url}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4, delay: hasHistory ? 0 : 0.38 + i * 0.05, ease: EASE }}
            className={`group/chip relative inline-flex items-center rounded-full border border-border bg-surface/70 backdrop-blur-md transition-colors hover:border-border-strong ${
              hasHistory ? "pl-3 pr-1.5" : "px-3"
            }`}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(item.url)}
              title={hasHistory ? item.url : undefined}
              className="py-1.5 font-mono text-[11.5px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {item.label}
            </button>
            {hasHistory && (
              <button
                type="button"
                aria-label={`Forget ${item.label}`}
                onClick={() => onRemove(item.url)}
                className="ml-1 grid h-4 w-4 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
