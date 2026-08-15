"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";

/**
 * How long these results have left.
 *
 * Worth saying plainly rather than hiding: somebody who has just scanned a page
 * needs to know the list will not be here when they come back tomorrow, and a
 * number counting down is more honest than a sentence they will read once and
 * forget. It stays quiet until the last minute, then turns urgent, so the
 * common case is a detail and the rare case is a warning.
 */

export function timeLeft(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Countdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: number;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() => timeLeft(expiresAt));

  useEffect(() => {
    setLeft(timeLeft(expiresAt));
    const id = setInterval(() => {
      const next = timeLeft(expiresAt);
      setLeft(next);
      if (next <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const urgent = left <= 60_000;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
        urgent
          ? "live-urgent border-warn/40 bg-warn-soft text-warn"
          : "border-border bg-surface-2/50 text-fg-2"
      }`}
      title={`Results clear ${SITE.resultsMinutes} minutes after a scan`}
    >
      {/* The dot glows and the ring leaves it, so the chip reads as running
          rather than as a printed value. */}
      <span aria-hidden className="relative grid h-2 w-2 place-items-center">
        <span
          className="live-halo absolute h-2 w-2 rounded-full"
          style={{ background: "currentColor" }}
        />
        <span
          className="live-dot h-2 w-2 rounded-full"
          style={{
            background: "currentColor",
            boxShadow: "0 0 6px currentColor, 0 0 12px currentColor",
          }}
        />
      </span>
      <span className="tabular-nums">{clock(left)}</span>
      <span className="hidden sm:inline opacity-70">left</span>
    </span>
  );
}
