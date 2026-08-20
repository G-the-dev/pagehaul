import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { SITE, LEGAL_LINKS } from "@/lib/site";
import { Mark } from "@/components/Mark";

/**
 * The shell every page that is not the tool itself sits inside.
 *
 * These pages are read, not operated, so the measure is narrow and the nav is
 * a plain link home rather than the floating pill from the landing page. Using
 * one shell means the four of them cannot drift apart.
 */
export function PageShell({
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  /** Legal pages show when the wording last changed. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-[16px] font-semibold tracking-tight"
          >
            <Mark size={16} />
            {SITE.name}
          </Link>
          {/* Dressed as the button it is. Bare uppercase text read as a
              label, and nobody presses a label. */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the tool
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-20">
        <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </span>

        <h1 className="mt-6 text-[2.25rem] font-medium leading-[1.14] tracking-tight sm:text-[2.8rem]">
          {title}
        </h1>

        {lede && (
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-fg-2">{lede}</p>
        )}

        {updated && (
          <p className="mt-6 font-mono text-[12.5px] text-muted-foreground">
            Last updated {updated}
          </p>
        )}

        <div className="legal mt-14">{children}</div>
      </article>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-10">
          {LEGAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[14.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <span className="ml-auto font-mono text-[12px] text-muted-foreground">
            &copy; {new Date().getFullYear()} {SITE.name}
          </span>
        </div>
      </footer>
    </main>
  );
}

/** A numbered section within a legal document. */
export function Clause({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-baseline gap-3 text-[18px] font-semibold tracking-tight">
        <span className="font-mono text-[13px] font-semibold text-muted-foreground">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-4 text-[16px] leading-[1.7] text-fg-2">{children}</div>
    </section>
  );
}
