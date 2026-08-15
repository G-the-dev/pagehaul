import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Contact · ${SITE.name}`,
  description:
    "Report a bug, send feedback, or get in touch. One person reads these.",
};

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Contact"
      title="Tell us what is wrong."
      lede="Bug reports are the most useful thing you can send, because most failures are specific to one site and we cannot see them from here."
    >
      <FeedbackForm />

      <div className="mt-14 space-y-5 text-[15px] leading-[1.7] text-fg-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          What makes a report useful
        </h2>
        <p>
          The address of the page it failed on, whether you used quick or deep,
          and what you expected to get. That is almost always enough to reproduce
          it. Screenshots help but are rarely necessary.
        </p>
        <p>
          Bugs can also go straight to the{" "}
          <a href={`${SITE.repo}/issues`} target="_blank" rel="noreferrer">
            issue tracker
          </a>
          , which is public and where the work happens.
        </p>

        <h2 className="!mt-10 text-[17px] font-semibold tracking-tight text-foreground">
          Rights and takedowns
        </h2>
        <p>
          If content of yours was copied through this service, or you want your
          domain blocked from being captured at all, that is covered in the{" "}
          <a href="/terms">terms</a>. Write to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> and it
          will be answered.
        </p>
      </div>
    </PageShell>
  );
}
