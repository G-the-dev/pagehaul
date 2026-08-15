import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact · ${SITE.name}`,
  description:
    "How to reach pagehaul, including where to send a takedown notice or a request to block a domain.",
};

/**
 * A list of addresses rather than a form.
 *
 * A contact form needs somewhere to send submissions, which means a mail
 * service, an API route, and spam handling. None of that exists yet, and a form
 * that silently fails is worse than an address that works. When there is volume
 * to justify it, this becomes a form.
 */
const ROUTES = [
  {
    label: "General",
    email: SITE.contactEmail,
    what: "Questions, feedback, a site it failed on, or an idea for what it should do next.",
  },
  {
    label: "Takedown and abuse",
    email: SITE.abuseEmail,
    what: "Content copied through this service that infringes your rights, or a request to block your domain from being captured at all.",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Get in touch."
      lede="One person reads these, so plain email works better than a form. Expect a reply within a few days."
    >
      <div className="space-y-4">
        {ROUTES.map((r) => (
          <div key={r.email} className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {r.label}
            </div>
            <a
              href={`mailto:${r.email}`}
              className="text-[17px] font-semibold tracking-tight text-foreground hover:underline"
            >
              {r.email}
            </a>
            <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              {r.what}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 space-y-6 text-[15px] leading-[1.7] text-fg-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          If you are reporting a takedown
        </h2>
        <p>
          Include the address that was captured, what was infringed, and how to
          reach you. We will respond, and we can block a domain from being
          captured entirely on a reasonable request from its owner.
        </p>
        <p>
          Worth knowing before you write: captures are deleted after{" "}
          {SITE.retentionMinutes} minutes, so by the time a notice arrives there
          is usually nothing left on our side to remove. Blocking future captures
          of your domain is the remedy that actually does something.
        </p>

        <h2 className="!mt-12 text-[17px] font-semibold tracking-tight text-foreground">
          If something is broken
        </h2>
        <p>
          The address of the page it failed on is the single most useful thing you
          can send, because most failures are specific to one site. Whether you
          used quick or deep, and what you expected to get, helps too.
        </p>
        <p>
          Bugs can also go straight to the{" "}
          <a href={`${SITE.repo}/issues`} target="_blank" rel="noreferrer">
            issue tracker
          </a>
          , which is public.
        </p>
      </div>
    </PageShell>
  );
}
