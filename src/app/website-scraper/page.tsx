import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, Clause } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Website Scraper Online: Free, No Signup, No Code · pagehaul",
  description:
    "Scrape any page visually, free and online. No code, no extension, no signup: the images, files, scripts, JSON payloads and API responses a page loads, in one grid.",
  alternates: { canonical: "/website-scraper" },
};

const FAQ = [
  {
    q: "Is there a free website scraper without signup?",
    a: "Yes, this one. Paste a link and scan; no account, no extension, no code. Quick scans are free and unlimited.",
  },
  {
    q: "Can I scrape a website without coding?",
    a: "That is the point of pagehaul. The scan runs the page in a real browser and hands you what it loaded, files, scripts, JSON payloads, API responses, in a grid you click, not a script you write.",
  },
  {
    q: "How do I see the API calls and JSON a page loads?",
    a: "Run a deep scan and open the Network tab. Every API request the page made is there with its method, status and response, downloadable like any file.",
  },
  {
    q: "Can it export scraped data to CSV or a spreadsheet?",
    a: "No, and honestly: if you need rows and columns from many pages, a selector-based scraper serves you better. pagehaul is for taking a page's actual material, its assets, code and payloads.",
  },
  {
    q: "Is web scraping legal?",
    a: "Reading public pages is generally lawful; what you do with the material is where rights begin. Downloading gives you no licence to anything. Built for sites you own, migrations, backups and reference.",
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

export default function WebsiteScraperPage() {
  return (
    <PageShell
      eyebrow="Website scraper"
      title="Scrape a page visually. No code, no extension."
      lede="Web scraping without writing a scraper: paste a link and get what the page actually loads, images, files, scripts, JSON payloads and API responses, in one grid, online and free."
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

      <Clause n="01" title="Scraping, without the scraper">
        <p>
          The usual road to a page&rsquo;s data runs through code: a Python
          script, a headless browser you configure, selectors that break next
          month, or an extension with permissions you would rather not grant.
          pagehaul runs that headless browser for you. It loads the page,
          scrolls it end to end, and records everything the page fetches,
          then shows it as a grid a person can read.
        </p>
        <p>
          That includes the parts scrapers are usually after: the API calls a
          page makes with their methods, statuses and JSON responses, the
          scripts and code it ships, and every asset it draws, images, SVGs,
          fonts, video, audio, documents and 3D models.
        </p>
      </Clause>

      <Clause n="02" title="Where it ends, honestly">
        <p>
          pagehaul scrapes one page at a time and hands you its material. It
          does not crawl a thousand product pages into a spreadsheet; a
          selector-based tool is the right instrument for that. What it does
          instead is make one page completely legible: for that, nothing is
          faster than{" "}
          <Link href="/website-downloader">downloading the whole page&rsquo;s
          assets</Link>, or going straight for{" "}
          <Link href="/image-downloader">the images</Link>.
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
