import Link from "next/link";
import type { Metadata } from "next";
import { SITE, LEGAL_LINKS } from "@/lib/site";

export const metadata: Metadata = {
  title: `Not found · ${SITE.name}`,
};

/**
 * The 404.
 *
 * A dead end should offer the way out rather than just announce the problem, so
 * the main action is the thing almost everyone arriving here wanted anyway.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 grid h-12 w-12 place-items-center rounded-xl border border-border bg-surface font-mono text-[14px] font-semibold text-muted-foreground">
          404
        </div>

        <h1 className="text-[2.05rem] font-medium leading-tight tracking-tight">
          That page does not exist.
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-[16px] leading-relaxed text-muted-foreground">
          The link may be wrong, or the page may have been removed. Nothing here
          expires except capture links, and those only last{" "}
          {SITE.retentionMinutes} minutes.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-[15px] font-semibold text-background transition-opacity hover:opacity-90"
        >
          Scan a page
        </Link>

        <div className="mt-12 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-border pt-6">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
