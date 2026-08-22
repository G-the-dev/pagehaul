import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Clause } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Website Downloader Online: an HTTrack Alternative in the Browser · pagehaul",
  description:
    "Download a website's assets online, no desktop app. Every image, icon, font, video and file from any page as a zip. The modern HTTrack alternative for grabbing assets.",
  alternates: { canonical: "/website-downloader" },
};

const FAQ = [
  {
    q: "How do I download a website's files without installing anything?",
    a: "Paste the address into pagehaul. It runs in your browser, scans the page, and hands you every asset it loads, downloadable one by one or as a zip.",
  },
  {
    q: "Is this the same as HTTrack?",
    a: "No, and on purpose. HTTrack mirrors whole sites into offline copies, which breaks on the JavaScript-built web. pagehaul extracts a page's actual assets, images, icons, fonts, video, audio, code, models, which is what most people mirroring a site were after.",
  },
  {
    q: "Does it work on modern JavaScript sites?",
    a: "Yes. A deep scan runs the page in a real browser and scrolls it, so single-page apps, lazy-loaded galleries and WebGL scenes give up their files like any other page.",
  },
  {
    q: "Can I download the whole site, every page?",
    a: "A scan covers one page completely. For a many-page site, scan the pages you need; each arrives organised and named, without the folder maze a mirroring tool leaves.",
  },
  {
    q: "Is it legal to download a website's files?",
    a: "Downloading gives you no rights to the material. It is built for sites you own, migrations, backups and reference.",
  },
];

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function WebsiteDownloaderPage() {
  return (
    <PageShell
      eyebrow="Website downloader"
      title="Download a website's assets, right from the browser."
      lede="No desktop app, no folder maze. Paste a link and take every image, icon, font, video and file the page is built from, named properly, zipped if you want."
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <div className="not-prose mb-12">
        <Link
          href="/"
          className="inline-block rounded-full bg-accent px-7 py-3 text-[15px] font-semibold !text-accent-fg no-underline transition-opacity hover:opacity-90"
        >
          Scan a page free
        </Link>
      </div>

      <Clause n="01" title="The HTTrack era, and what replaced it">
        <p>
          For twenty years, downloading a website meant HTTrack: install a
          desktop app, mirror the whole site, then dig through a maze of
          folders for the one asset you wanted. That worked when websites
          were files on a server. Today&rsquo;s web is built by JavaScript at
          the moment of loading, and mirroring tools bring back empty shells.
        </p>
        <p>
          pagehaul starts from what people actually opened those mirrors for:
          the assets. It runs the page in a real browser, records everything
          the page loads, and hands it to you sorted, previewed and named,
          images, SVG icons, fonts, video, audio, documents, scripts, even 3D
          models, in your own browser, with nothing to install.
        </p>
      </Clause>

      <Clause n="02" title="What you get from a scan">
        <p>
          Every image at full quality with its srcset family grouped. Inline
          and hosted SVGs. Fonts under their real family names. Video, audio,
          JSON payloads and code. On a deep scan, full-page and per-section
          screenshots, plus the page&rsquo;s color palette, typography and
          design tokens. Take one file, or select a set and get a zip built
          in your browser, organised into folders by kind with a manifest.
          Looking for pictures alone? The{" "}
          <Link href="/image-downloader">image downloader</Link> page covers
          that path.
        </p>
      </Clause>

      <Clause n="03" title="Questions people ask">
        <div className="space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <p className="font-semibold text-foreground">{f.q}</p>
              <p className="mt-1">{f.a}</p>
            </div>
          ))}
        </div>
      </Clause>
    </PageShell>
  );
}
