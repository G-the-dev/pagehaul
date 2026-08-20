import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `About · ${SITE.name}`,
  description:
    "Why pagehaul exists, what it does differently, and what it deliberately will not do.",
};

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="Why this exists."
      lede="Most tools in this space hand you a folder and wish you luck. This one tries to tell you what it found."
    >
      <div className="space-y-6 text-[16.5px] leading-[1.75] text-fg-2">
        <p>
          Getting one image off a web page is harder than it should be. Open the
          developer tools, find the network tab, filter by type, scroll through a
          list of hashed filenames, guess which is the one you want, right click,
          copy the address, open it in a tab, save it. Or download the whole site
          as a forty megabyte archive and go hunting through folders instead.
        </p>
        <p>
          Neither of those is a good answer, and both are what the existing tools
          offer. {SITE.name} shows you what a page is made of, with names you can
          read and previews you can look at, and lets you take the one file you
          came for.
        </p>

        <h2 className="!mt-12 text-[18px] font-semibold tracking-tight text-foreground">
          What it does differently
        </h2>
        <p>
          <strong className="text-foreground">It runs the page.</strong> Most of
          the web is built by JavaScript now. Tools that only read the markup a
          server sends get an empty shell and report it as a result. This one
          opens the page in a real browser and scrolls it, so lazy images and
          anything a script adds actually appear.
        </p>
        <p>
          <strong className="text-foreground">It names things properly.</strong>{" "}
          A file called <code>d53b014d86a6b6.woff2</code> tells you nothing. Where
          a name is a hash, the label comes from the alt text, the real font
          family, or where on the page it sits.
        </p>
        <p>
          <strong className="text-foreground">
            It shows more than pictures.
          </strong>{" "}
          Fonts, documents, scripts, and the API calls a page makes, with their
          method, status and response. That last one is unusual, and it is there
          because the developer looking for a JSON payload has the same problem as
          the designer looking for a logo.
        </p>

        <h2 className="!mt-12 text-[18px] font-semibold tracking-tight text-foreground">
          What it will not do
        </h2>
        <p>
          It will not get past a login. Sites that serve their media only to
          signed-in sessions hand an automated browser an empty page, and working
          around that means defeating access control rather than solving a
          technical problem. When it happens, the tool says so plainly instead of
          returning nothing and calling it a success.
        </p>
        <p>
          It will not modify anything it captures. No injected scripts, no
          analytics, no altered JavaScript. Files arrive exactly as the server
          sent them. A competitor in this space was caught tampering with
          downloaded code, and it cost them everything.
        </p>
        <p>
          It will not keep your files. Everything you capture goes straight to
          your browser, archives are built on your own device, and nothing is
          read, indexed or retained on our side.
        </p>

        <h2 className="!mt-12 text-[18px] font-semibold tracking-tight text-foreground">
          An honest word about rights
        </h2>
        <p>
          A tool that makes copying easy is worth being careful with. Downloading
          a file gives you no rights to it, and most images, fonts and video carry
          licences that forbid the use someone downloading them has in mind.
        </p>
        <p>
          This is built for sites you own, for migrations and backups, for
          rebuilding something you lost, and for reference. If you are looking at
          someone else&rsquo;s work, look at it as reference. The{" "}
          <a href="/terms">terms</a> say the same thing in more words.
        </p>

        <h2 className="!mt-12 text-[18px] font-semibold tracking-tight text-foreground">
          Who made it
        </h2>
        <p>
          A small independent project. It will be open source soon. If
          something does not work, or works in a way that surprises you,{" "}
          <a href="/contact">say so</a>.
        </p>
      </div>
    </PageShell>
  );
}
