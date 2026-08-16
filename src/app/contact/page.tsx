import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FeedbackForm } from "@/components/FeedbackForm";
import { ContactEmail } from "@/components/ContactEmail";
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
      <div className="space-y-4">
        <FeedbackForm />
        <ContactEmail />
      </div>

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
          If content of yours was copied through this service, or you want your
          domain blocked from being captured at all, that is covered in the{" "}
          <a href="/terms">terms</a>.
        </p>
      </div>
    </PageShell>
  );
}
