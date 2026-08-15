"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The 500, for anything that throws while rendering a route.
 *
 * It has to be a client component and it has to accept reset, because that is
 * how Next.js offers a retry without a full page reload. Most errors here are
 * transient, so retrying is genuinely the right first move.
 *
 * The error message itself is deliberately not shown. It is a stack trace or a
 * framework string, which tells a visitor nothing and can leak internals.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Reaches the server logs, where it is actually useful.
    console.error("Route error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 grid h-12 w-12 place-items-center rounded-xl border border-danger/40 bg-danger-soft font-mono text-[13px] font-semibold text-danger">
          500
        </div>

        <h1 className="text-[1.9rem] font-medium leading-tight tracking-tight">
          Something broke on our side.
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
          Not your fault, and nothing you submitted was lost, because nothing is
          stored. Trying again usually works.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-[14px] font-semibold text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-[14px] font-medium text-fg-2 transition-colors hover:border-border-strong hover:text-foreground"
          >
            Start over
          </Link>
        </div>

        {/* The digest is the one thing worth showing: it is the handle that
            matches this failure to a line in the server logs. */}
        {error.digest && (
          <p className="mt-10 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
