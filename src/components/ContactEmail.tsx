"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * Email as a peer of the form, not a footnote beside its button.
 *
 * Some people will never use a form, and until the sending service is
 * configured this is the only route that actually delivers. Either way it earns
 * the same card, border and padding the form gets.
 */
export function ContactEmail() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(SITE.contactEmail).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {
        // Clipboard can be refused. The address is selectable either way.
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 sm:p-7">
      <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        Or write to us
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`mailto:${SITE.contactEmail}`}
          className="text-[19px] font-semibold tracking-tight text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground sm:text-[21px]"
        >
          {SITE.contactEmail}
        </a>

        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Address copied" : "Copy the address"}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      <p className="mt-3.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
        Goes to a person, not a queue. Use it for anything the form does not
        cover, including rights and takedown notices.
      </p>
    </div>
  );
}
