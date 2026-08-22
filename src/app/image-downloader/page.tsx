import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Clause } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Image Downloader: Download All Images from Any Website · pagehaul",
  description:
    "Free online image downloader. Paste a URL and download every image on the page, JPG, PNG, WebP, SVG, at full quality, one by one or as a zip. No signup.",
  alternates: { canonical: "/image-downloader" },
};

const FAQ = [
  {
    q: "How do I download all images from a website at once?",
    a: "Paste the page's address into pagehaul and scan. Every image appears in one grid with previews and real names; select them all and download one zip.",
  },
  {
    q: "Does it get the full-quality originals?",
    a: "Yes. pagehaul reads every srcset size a page declares and marks the largest, so you take the original, not the thumbnail your screen happened to load.",
  },
  {
    q: "Does it work on lazy-loaded galleries?",
    a: "A deep scan runs the page in a real browser and scrolls it end to end, so lazy-loaded and JavaScript-built galleries load and give up their files.",
  },
  {
    q: "Can I download images from a link on my phone?",
    a: "Yes. On a phone, pick the kinds of files you want and take the zip; the full preview grid is best on a desktop.",
  },
  {
    q: "Is it legal to download images from a website?",
    a: "Downloading gives you no rights to a file; most images carry licences. pagehaul is built for sites you own, migrations, backups and reference.",
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

export default function ImageDownloaderPage() {
  return (
    <PageShell
      eyebrow="Image downloader"
      title="Download every image from any website."
      lede="Paste a link. Every image on the page shows up in one grid, previewed and properly named, ready to take one at a time or all at once as a zip."
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

      <Clause n="01" title="What makes it different">
        <p>
          Most image downloaders read a page&rsquo;s markup and stop, which is
          why they come back with a handful of thumbnails from pages that
          clearly hold hundreds of pictures. pagehaul&rsquo;s deep scan opens
          the page in a real browser, scrolls it end to end, and records what
          the page actually loads: lazy-loaded galleries, CSS backgrounds,
          script-built carousels, every srcset size.
        </p>
        <p>
          The grid shows real previews with readable names instead of hashed
          filenames, marks the largest version of each image family, and
          filters out tracking pixels and placeholder blanks so what you see
          is what is worth taking.
        </p>
      </Clause>

      <Clause n="02" title="Formats and quality">
        <p>
          JPG, PNG, WebP, AVIF, GIF and SVG, at the full quality the site
          serves. Where a picture exists in several sizes, they are grouped as
          one family with the original marked, so a 2400px hero never hides
          behind its 300px thumbnail.
        </p>
      </Clause>

      <Clause n="03" title="One image or the whole page">
        <p>
          Click a file and it downloads alone. Select any set and it arrives
          as one zip, organised into folders by kind with a manifest, built
          entirely in your browser: nothing you take ever touches our
          servers. More than images on the page? The same scan collects{" "}
          <Link href="/website-downloader">every other asset too</Link>: SVG
          icons, fonts, video, audio and 3D models.
        </p>
      </Clause>

      <Clause n="04" title="Questions people ask">
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
