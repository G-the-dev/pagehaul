import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { PlansGrid } from "@/components/Paywall";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Pricing · ${SITE.name}`,
  description:
    "Quick scans are free forever. Two deep scans free, then ₹99 a month or a ₹99 pack of 25.",
};

export default function PricingPage() {
  return (
    <PageShell
      eyebrow="Pricing"
      title="Less than a coffee."
      lede="Quick scans are free forever. Deep scans — the real browser, the design system, the 3D files — start free and stay cheap, in rupees."
    >
      <div className="not-prose">
        <PlansGrid origin="pricing-page" />
      </div>
      <div className="mt-10 space-y-4 text-[14px] leading-[1.75] text-fg-2">
        <p>
          The free plan deep-scans {""}two sites, and rescanning those sites stays
          free — heavy pages sometimes ask for a second pass, and a retry is never
          charged. Pro removes the limit and unlocks the design system and 3D
          files everywhere. A pack does the same, twenty-five scans at a time,
          with no subscription.
        </p>
        <p>
          Payments are handled by Razorpay — UPI, cards and netbanking. Nothing
          about a scan is stored on our servers either way: results live in your
          browser and expire there.
        </p>
      </div>
    </PageShell>
  );
}
