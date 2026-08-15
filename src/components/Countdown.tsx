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
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] transition-colors ${
        urgent ? "text-warn" : "text-muted-foreground"
      }`}
      title={`These results clear ${SITE.resultsMinutes} minutes after a scan. Nothing is stored on our side; the list is addresses and your browser fetches each file from the site it came from.`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          urgent ? "animate-pulse bg-warn" : "bg-muted-foreground/60"
        }`}
      />
      <span className="tabular-nums">{clock(left)}</span>
      <span className="hidden sm:inline">left</span>
    </span>
  );
}
