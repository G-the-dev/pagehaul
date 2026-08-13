"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STEPS = [
  {
    n: "01",
    h: "Paste a link",
    p: "Any public page. Quick reads the markup and stylesheets. Deep runs the page in a real browser and records every file it requests.",
  },
  {
    n: "02",
    h: "See what it is built from",
    p: "Images, icons, video, fonts, documents, scripts and the network calls the page makes, sorted into one grid with readable names.",
  },
  {
    n: "03",
    h: "Take what you need",
    p: "Click one file to download it. Or choose a set and get a tidy archive with a manifest. Nothing to unzip and search.",
  },
];

const FAQ = [
  {
    q: "How is this different from right-clicking and saving?",
    a: "A right-click gets you one visible image. Most of a page is not reachable that way: background images defined in CSS, every size in a srcset, fonts buried in stylesheets, video sources, and images that only exist inside a JavaScript payload until the page runs. pagehaul lists all of it in one place.",
  },
  {
    q: "What is the difference between quick and deep scan?",
    a: "Quick reads the HTML and stylesheets without running any JavaScript, so it finishes in seconds and covers most server rendered sites. Deep opens the page in a real browser, scrolls it to trigger lazy loading, and records every response it receives. On a JavaScript heavy site deep typically finds three to four times as much.",
  },
  {
    q: "Can it get files from a page that needs a login?",
    a: "No. Sites like X, Instagram and Facebook serve their media only to signed in sessions. That is access control rather than a technical hurdle, so pagehaul tells you plainly when it happens instead of returning an empty result. A browser extension carrying your own session would solve it, and that is not built yet.",
  },
  {
    q: "Do you store the files on your servers?",
    a: "No. The scan returns a list of file addresses and details. Your browser then fetches the files directly from the original site and builds any archive locally. Nothing is uploaded, stored or kept.",
  },
  {
    q: "Why do some files fail to download?",
    a: "Some servers refuse to let another site read their files, which browsers enforce. Previews still work because displaying a file is allowed even when reading its bytes is not. When a download is refused pagehaul opens the file in a new tab so you can save it manually.",
  },
  {
    q: "Is it legal to use?",
    a: "Downloading files does not transfer any rights to them. Images, fonts and video usually carry licences, and copying a brand's assets for your own commercial work can infringe. Use it for sites you own, for migrations, for backups, and for reference. What you do with what you take is your responsibility.",
  },
];

export function Steps() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="label-mono mb-3 text-accent">{s.n}</div>
              <h3 className="mb-2 text-[15px] font-semibold">{s.h}</h3>
              <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                {s.p}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-10 text-[1.75rem] font-medium tracking-tight sm:text-[2rem]">
          Questions
        </h2>
        <Accordion multiple={false} className="w-full">
          {FAQ.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="py-5 text-left text-[15px] font-medium hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-[14px] leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-6 pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
          <p className="max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
            Built for designers and developers who are tired of the Network tab.
          </p>
          <div className="flex items-center gap-6 font-mono text-[11px] text-muted-foreground">
            <a
              href="https://github.com/G-the-dev/pagehaul"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <span>&copy; {new Date().getFullYear()} pagehaul</span>
          </div>
        </div>
      </div>

      {/* Oversized wordmark, cropped at the baseline so it reads as a mark
          rather than a heading. */}
      <div
        aria-hidden
        className="select-none px-4 pb-2"
        style={{ lineHeight: 0.78 }}
      >
        <div className="bg-gradient-to-b from-foreground/85 to-foreground/15 bg-clip-text text-center text-[clamp(3.5rem,17vw,15rem)] font-semibold tracking-tighter text-transparent">
          pagehaul
        </div>
      </div>
    </footer>
  );
}
