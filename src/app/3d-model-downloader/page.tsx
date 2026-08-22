import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Clause } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "3D Model Downloader: Extract GLB and glTF Models from Any Website · pagehaul",
  description:
    "Download 3D models from websites free, GLB, glTF and more, including models three.js sites assemble at runtime. Previews first. Online, no extension needed.",
  alternates: { canonical: "/3d-model-downloader" },
};

const FAQ = [
  {
    q: "How do I download a 3D model from a website?",
    a: "Paste the address into pagehaul and run a deep scan. Every model the page loads appears under the 3D tab with a rendered preview, ready to download.",
  },
  {
    q: "What 3D formats does it find?",
    a: "GLB and glTF primarily, the formats the web actually ships, plus OBJ, FBX and STL where pages serve them. Draco-compressed models preview too.",
  },
  {
    q: "Can it extract models from three.js websites?",
    a: "Yes. Sites built on three.js often assemble models at runtime instead of loading one file; a deep scan watches the page's network like a browser does and records the model files it fetches.",
  },
  {
    q: "Do I need a browser extension?",
    a: "No. pagehaul runs entirely in the browser you already have; paste a link and scan.",
  },
  {
    q: "Can I use a downloaded 3D model in my own project?",
    a: "Downloading gives you no rights to it. Models carry licences like any asset. Built for your own sites, migrations, backups and reference.",
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

export default function ThreeDModelDownloaderPage() {
  return (
    <PageShell
      eyebrow="3D model downloader"
      title="Download 3D models from any website."
      lede="GLB, glTF and the rest, including models that three.js sites assemble at runtime. Rendered previews before you download, no extension to install."
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

      <Clause n="01" title="Why 3D is the hardest asset to take">
        <p>
          A WebGL site does not hand you a model file. It fetches geometry,
          textures and animations over the network, sometimes in pieces,
          sometimes as JSON that only three.js understands, and assembles the
          scene in memory. View-source shows you nothing; there is no
          right-click for a spinning product model.
        </p>
        <p>
          pagehaul&rsquo;s deep scan runs the page in a real browser and
          records what it actually fetches. GLB and glTF files are collected
          whole, runtime-assembled models are recognised from the network
          traffic, and each model gets a rendered preview in the 3D tab so
          you know what you are taking before you take it.
        </p>
      </Clause>

      <Clause n="02" title="Formats, previews, and the rest of the page">
        <p>
          GLB and glTF are the web&rsquo;s native 3D formats, and Draco
          compression is handled for previews. OBJ, FBX and STL are collected
          where pages serve them directly. And because a scan reads the whole
          page, the textures, environment images and audio a scene uses are
          sitting in the neighbouring tabs, along with{" "}
          <Link href="/image-downloader">every image</Link> and{" "}
          <Link href="/svg-extractor">every SVG</Link>.
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
