import type { Metadata } from "next";
import { PageShell, Clause } from "@/components/PageShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Terms · ${SITE.name}`,
  description:
    "The terms for using pagehaul, including what you promise about the sites you capture and how takedown notices are handled.",
};

export default function TermsPage() {
  return (
    <PageShell
      eyebrow="Terms"
      title="Terms and conditions."
      lede="Plain English, because terms nobody reads protect nobody. Using this service means agreeing to what follows."
      updated={SITE.legalUpdated}
    >
      <Clause n="01" title="What this service does">
        <p>
          {SITE.name} loads a web page you name, records the files that page
          requests, and makes those files available to you. It is a tool. It has
          no view on what you point it at and forms no relationship with the sites
          it visits.
        </p>
        <p>
          It is provided free, with no account, and with no guarantee that it will
          keep working, keep being free, or work on any particular site.
        </p>
      </Clause>

      <Clause n="02" title="What you promise">
        <p>
          By submitting an address you confirm that you have the right to copy the
          material at it. That means you own the site, you have permission from
          whoever does, or the material is licensed or in the public domain in a
          way that permits what you are doing.
        </p>
        <p>
          You take responsibility for that judgement. We cannot assess it for you
          and we do not try to.
        </p>
        <p>You also agree not to use this service to:</p>
        <ul className="ml-5 list-disc space-y-2">
          <li>copy material you have no right to copy</li>
          <li>defeat a paywall, login, or any other access control</li>
          <li>overload, disrupt or attack the site being captured</li>
          <li>capture material that is unlawful where you or we are</li>
          <li>rebuild someone else&rsquo;s site and present it as your own</li>
        </ul>
      </Clause>

      <Clause n="03" title="Downloading gives you no rights">
        <p>
          This is the part most people get wrong, so it is stated plainly. Getting
          a copy of a file does not give you any right to use it.
        </p>
        <p>
          Images, fonts, video and typefaces almost always carry licences, and
          those licences usually forbid exactly the thing someone downloading them
          intends. Whether you may use what you take is a separate question from
          whether you could take it, and it remains entirely yours to answer.
        </p>
      </Clause>

      <Clause n="04" title="We do not keep your content">
        <p>
          Files pass through this service; they do not live in it. Any archive we
          package is deleted after {SITE.retentionMinutes} minutes, and we do not
          read, index or retain what you capture.
        </p>
        <p>
          We do keep a record of the addresses submitted, so that a takedown
          notice can be answered. That is described in the{" "}
          <a href="/privacy">privacy policy</a>.
        </p>
      </Clause>

      <Clause n="05" title="Takedown notices">
        <p>
          If you believe material was copied through this service in a way that
          infringes your rights, write to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with the
          address concerned, what was infringed, and how to reach you.
        </p>
        <p>
          We will respond. Where the complaint is about a site being captured
          repeatedly, we can block that domain outright, and we will do so on a
          reasonable request from the owner.
        </p>
        <p>
          Because captures are deleted within {SITE.retentionMinutes} minutes,
          there is usually nothing left for us to remove by the time a notice
          arrives. Blocking future captures is the meaningful remedy.
        </p>
      </Clause>

      <Clause n="06" title="Limits and fair use">
        <p>
          Requests are limited per address to keep the service available and to
          avoid placing load on the sites being captured. We may refuse or block
          any request, and we may block a domain at its owner&rsquo;s request or
          on our own judgement, without explanation.
        </p>
      </Clause>

      <Clause n="07" title="No warranty">
        <p>
          The service is provided as it is. It may miss files, misread a page,
          fail on a site that blocks automated visitors, or stop working entirely.
          Nothing here is a promise of accuracy, completeness or availability.
        </p>
        <p>
          To the extent the law allows, we are not liable for any loss arising
          from using it, including loss of data, business or anything you did with
          what you downloaded.
        </p>
      </Clause>

      <Clause n="08" title="Changes and contact">
        <p>
          These terms may change. The date at the top will change with them, and
          continuing to use the service means accepting the current version.
        </p>
        <p>
          Questions go to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </Clause>
    </PageShell>
  );
}
