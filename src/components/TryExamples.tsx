"use client";

import { motion } from "framer-motion";
import { EASE } from "./ui/motion-primitives";

/**
 * Visitors stall at the input because nothing tells them what a valid target
 * looks like. These are real pages, one click away, each labelled with what a
 * scan of it actually returns.
 */
const EXAMPLES = [
  { host: "stripe.com", what: "Photography and icon sets", n: "331 files" },
  { host: "linear.app", what: "Product shots and video", n: "180 files" },
  { host: "vercel.com", what: "Fonts and design tokens", n: "240 files" },
  { host: "framer.com", what: "Motion and imagery", n: "290 files" },
];

/** A minimal mark per row, drawn rather than fetched, so nothing loads. */
function Mark({ i }: { i: number }) {
  const shapes = [
    <rect key="a" x="5" y="5" width="14" height="14" rx="4" />,
    <circle key="b" cx="12" cy="12" r="7" />,
    <path key="c" d="M12 4 20 20H4Z" />,
    <path key="d" d="M12 3v18M3 12h18" />,
  ];
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-foreground/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      {shapes[i % shapes.length]}
    </svg>
  );
}

export function TryExamples({
  onPick,
  disabled,
}: {
  onPick: (host: string) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.34, ease: EASE }}
      className="pointer-events-auto mx-auto mt-12 w-full max-w-3xl"
    >
      <p className="mb-4 text-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        Works on any public page. Try one
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {EXAMPLES.map((e, i) => (
          <motion.button
            key={e.host}
            type="button"
            disabled={disabled}
            onClick={() => onPick(e.host)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 + i * 0.06, ease: EASE }}
            whileHover={{ y: -3 }}
            className="group flex flex-col gap-2 rounded-xl border border-border bg-surface/70 p-3.5 text-left backdrop-blur-md transition-colors hover:border-border-strong disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border bg-surface-2">
                <Mark i={i} />
              </span>
              <span className="truncate text-[13px] font-medium">{e.host}</span>
            </span>
            <span className="text-[11.5px] leading-snug text-muted-foreground">
              {e.what}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70 transition-colors group-hover:text-foreground/70">
              {e.n}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
