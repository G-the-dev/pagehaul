import type { Metadata } from "next";
import { PageShell, Clause } from "@/components/PageShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Privacy · ${SITE.name}`,
  description:
    "What pagehaul collects, what it does not, and how long anything is kept. There are no accounts and no advertising; analytics shows us how the site is used.",
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy"
      title="What we collect, and what we do not."
      lede="Short, because there is not much to say. There are no accounts and no advertising; we run analytics so we can see how the site is used and where it fails."
      updated={SITE.legalUpdated}
    >
      <Clause n="01" title="Analytics, and what it sees">
        <p>
          No account is required to use {SITE.name}, so for most visitors we
          hold no name, email address or password. If you buy a plan, we ask
          for an email address; what happens to it is in the payments section
          below. There is no advertising, and nothing about you is sold to
          anyone.
        </p>
        <p>
          We use PostHog for product analytics: pages visited, buttons pressed,
          and session replays showing how the interface behaved. A replay
          captures the {SITE.name} interface as you saw it, including the
          results of a scan on your screen. We use this to find what is broken
          and what is confusing, and for nothing else.
        </p>
        <p>
          Beyond that, your browser keeps your theme choice, your recent scans,
          your remaining free-scan count and, if you bought a plan, your
          license, all in local storage on your own device. You can clear them
          at any time; clearing also removes the license, which is why the
          receipt email carries a copy.
        </p>
      </Clause>

      <Clause n="02" title="The addresses you submit">
        <p>
          When you scan a page, the address you enter is sent to our server so it
          can be fetched. We record the submitted address, the time, and the IP
          address it came from.
        </p>
        <p>
          There is one reason for this. If a site owner tells us their content was
          copied through this service, we need to be able to find that request and
          act on it. Without a record we could not answer a takedown notice, and a
          service like this one has to be able to.
        </p>
        <p>
          These records are kept for no longer than 90 days and are not used for
          profiling, advertising or resale.
        </p>
        <p>
          To enforce the free plan&rsquo;s scan allowance, the server also keeps
          a short-lived count of deep scans per hashed network address. It holds
          a one-way hash rather than the address itself, lives in memory only,
          and is gone within days.
        </p>
      </Clause>

      <Clause n="03" title="When you buy a plan">
        <p>
          A purchase asks for your email address. It is used for exactly three
          things: sending your receipt and license, matching a payment to you
          if something goes wrong, and restoring a license your browser lost.
          It is embedded in the license itself and appears in the payment
          notification we receive.
        </p>
        <p>
          Payments are made by UPI, directly from your bank to ours. We never
          see or store card numbers, bank details or UPI PINs; your payment app
          handles all of that. What we keep is the payment reference, the plan,
          the amount and your email, for as long as needed to honour the
          license and answer disputes.
        </p>
      </Clause>

      <Clause n="04" title="The files themselves">
        <p>
          Files travel from the site you named to your browser; they are never
          stored with us. When you download an archive, your own browser builds
          it on your own device. Scan results live in your browser and expire
          there after {SITE.resultsMinutes} minutes.
        </p>
        <p>
          We do not read, index, analyse or retain the contents of what you
          capture, and there is nothing to delete on our side, because no copy
          of anyone&rsquo;s site ever exists in our systems.
        </p>
      </Clause>

      <Clause n="05" title="Services we rely on">
        <p>
          The site is hosted on Vercel, analytics is processed by PostHog, and
          email, receipts, licenses and feedback, is delivered by Resend. Each
          processes requests on our behalf and will see the usual technical
          information any web request carries, including IP address, as part of
          serving and protecting the service.
        </p>
        <p>
          When you scan a page, your browser and our server both make requests to
          that site. It will see those requests in its own logs, in the ordinary
          way any visit is logged. That is outside our control.
        </p>
      </Clause>

      <Clause n="06" title="Your rights">
        <p>
          You can ask what we hold about a request, ask for it to be deleted, or
          object to us holding it. Write to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
        <p>
          Because there are no accounts, we will usually need the address you
          scanned and roughly when, in order to find the record at all.
        </p>
      </Clause>

      <Clause n="07" title="Changes">
        <p>
          If this policy changes in a way that affects what we collect, the date
          at the top will change and the previous wording will no longer apply.
          There is no mailing list to notify; unless you bought a plan, we have
          no way to reach you.
        </p>
      </Clause>
    </PageShell>
  );
}
