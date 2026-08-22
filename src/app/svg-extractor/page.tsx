import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Clause } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "SVG Extractor: Download SVG Icons and Logos from Any Website · pagehaul",
  description:
    "Extract and download SVG files from any website, including inline SVGs that never exist as files. Save icons and logos, or copy source straight into Figma. Free.",
  alternates: { canonical: "/svg-extractor" },
};

const FAQ = [
  {
    q: "How do I save an SVG file from a website?",
    a: "Paste the address into pagehaul and open the Icons tab. Every SVG on the page is there, downloadable as files or copyable as source.",
  },
  {
    q: "Can it extract inline SVGs that are not files?",
    a: "Yes. Most icons live inline in the markup and never exist as files anywhere; pagehaul collects them anyway and turns each into a downloadable SVG.",
  },
  {
    q: "How do I extract a logo from a website?",
    a: "Logos are usually SVG or high-resolution images. Scan the page and check the Icons and Images tabs; the copy button hands an SVG logo to Figma as editable vectors.",
  },
  {
    q: "Can I paste an extracted SVG into Figma?",
    a: "Yes. Copy an SVG as source in pagehaul and paste into Figma; it arrives as editable vector layers, not a flattened image.",
  },
  {
    q: "Is it legal to use an SVG icon from another website?",
    a: "Downloading gives you no rights to it. Icons carry licences like any asset. Built for sites you own, migrations and reference.",
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

export default function SvgExtractorPage() {
  return (
    <PageShell
      eyebrow="SVG extractor"
      title="Extract every SVG from any website."
      lede="Icons, logos, illustrations, including the inline ones that never exist as files. Download them as SVGs, or copy the source straight into Figma as editable vectors."
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

      <Clause n="01" title="The inline SVG problem">
        <p>
          The icons you want are almost never files. Modern sites inline
          their SVGs straight into the markup, which is why right-click has
          no &ldquo;save image&rdquo; for them and why most downloaders come
          back empty. pagehaul reads the rendered page, collects every inline
          SVG, and turns each one into a real, downloadable file, alongside
          the hosted .svg files the page loads normally.
        </p>
        <p>
          Empty vector wrappers and invisible spacer graphics are filtered
          out, so the Icons tab holds actual icons, previewed on the checker
          board where transparent shapes stay legible.
        </p>
      </Clause>

      <Clause n="02" title="Straight into Figma or your editor">
        <p>
          Every SVG can be copied as source. Paste into Figma and it arrives
          as editable vector layers; paste into a code editor and it is
          markup, ready to inline. Or download any selection as files, one
          zip, organised and named. The same scan also collects{" "}
          <Link href="/image-downloader">every image</Link>, font, video and{" "}
          <Link href="/3d-model-downloader">3D model</Link> on the page.
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
