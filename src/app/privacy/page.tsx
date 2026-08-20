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
          No account is required to use {SITE.name}, so we hold no name, email
          address or password. There is no advertising, and nothing about you is
          sold to anyone.
        </p>
        <p>
          We use PostHog for product analytics: pages visited, buttons pressed,
          and session replays showing how the interface behaved. A replay
          captures the {SITE.name} interface as you saw it, including the
          results of a scan on your screen. We use this to find what is broken
          and what is confusing, and for nothing else.
        </p>
        <p>
          Beyond that, your browser keeps your theme choice and your recent
          scans in local storage, on your own device. Those never reach us and
          you can clear them at any time.
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
      </Clause>

      <Clause n="03" title="The files themselves">
        <p>
          Files are fetched from the site you named, not from us. Where a capture
          is packaged for download, the archive is deleted after{" "}
          {SITE.retentionMinutes} minutes and the link stops working at the same
          moment.
        </p>
        <p>
          We do not read, index, analyse or retain the contents of what you
          capture. The short retention window is deliberate: it keeps storage cost
          near zero and limits how long a copy of anyone&rsquo;s site exists
          anywhere in our systems.
        </p>
      </Clause>

      <Clause n="04" title="Services we rely on">
        <p>
          The site is hosted on Vercel, finished archives are stored briefly on
          Cloudflare R2, and analytics is processed by PostHog. Each processes
          requests on our behalf and will see the usual technical information
          any web request carries, including IP address, as part of serving and
          protecting the service.
        </p>
        <p>
          When you scan a page, your browser and our server both make requests to
          that site. It will see those requests in its own logs, in the ordinary
          way any visit is logged. That is outside our control.
        </p>
      </Clause>

      <Clause n="05" title="Your rights">
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

      <Clause n="06" title="Changes">
        <p>
          If this policy changes in a way that affects what we collect, the date
          at the top will change and the previous wording will no longer apply.
          There is no mailing list to notify, because we do not have your email.
        </p>
      </Clause>
    </PageShell>
  );
}
