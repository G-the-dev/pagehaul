"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE, Reveal, Section, Chip } from "./ui/motion-primitives";

/**
 * Ordered the way a first time visitor actually asks: what does it cost, is it
 * safe, then the two troubleshooting questions that otherwise become support
 * mail, then the licence question nobody else answers honestly.
 */
const FAQ = [
  {
    q: "Is it free?",
    a: "Yes, and there is no account. Paste a link and scan. Nothing is metered, nothing is gated, and you are not asked for an email before you find out whether it works on your site.",
  },
  {
    q: "Do you store the files, or my scans?",
    a: "No. A scan returns a list of file addresses and details, not the files themselves. Your browser fetches each file directly from the original site and builds any archive on your own machine. Nothing is uploaded to us, and there is no scan history to leak because we never keep one.",
  },
  {
    q: "It only found a handful of files. Why?",
    a: "Almost always because the page builds itself with JavaScript and you ran a quick scan. Quick reads the markup as delivered, so it misses anything added after load. Switch to deep, which opens the page in a real browser, scrolls it to trigger lazy loading, and records every file it requests. On a JavaScript heavy site deep commonly finds three or four times as much.",
  },
  {
    q: "Can it get files from Instagram, X, or anything behind a login?",
    a: "No, and no tool can do that honestly. Those sites serve their media only to signed in sessions, so an automated browser receives the page shell and nothing else. You can see those images yourself precisely because you are logged in. pagehaul says so plainly when it hits this rather than returning an empty result and calling it a success. A browser extension carrying your own session is the real answer, and it is not built yet.",
  },
  {
    q: "What exactly does it find?",
    a: "Images in every format, including each size in a srcset. SVG icons whether linked or written inline. Video and audio sources with their posters and caption tracks. Web fonts with their real family names. PDFs and documents. Stylesheets and scripts. And the API calls the page makes, with their method, status and response. A deep scan also reads the palette the page paints with and the design tokens it declares.",
  },
  {
    q: "A file would not download. What happened?",
    a: "Some servers refuse to let another site read their files, and browsers enforce that. Previews still work, because displaying a file is permitted even when reading its bytes is not. When a download is refused pagehaul opens that file in a new tab so you can save it manually, rather than failing quietly.",
  },
  {
    q: "Am I allowed to use what I download?",
    a: "Downloading a file gives you no rights to it. Images, fonts and video usually carry licences, and putting a brand's assets into your own commercial work can infringe them. This is built for sites you own, for migrations and backups, for rebuilding something you lost, and for reference. What you do with what you take is your responsibility.",
  },
];

function FaqRow({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <Reveal delay={index * 0.04}>
      <div className="border-b border-border/50 last:border-b-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex w-full items-start justify-between gap-6 py-5 text-left"
        >
          <span className="text-[16px] font-medium leading-snug text-fg-2 transition-colors group-hover:text-foreground">
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-border-strong group-hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="max-w-2xl pb-7 pr-10 text-[14.5px] leading-[1.75] text-muted-foreground">
                {a}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <Chip>FAQ</Chip>
            <h2 className="mt-6 text-[2rem] font-medium leading-[1.12] tracking-tight sm:text-[2.5rem]">
              Your questions,
              <br />
              answered plainly.
            </h2>
            <p className="mt-5 max-w-xs text-[14.5px] leading-relaxed text-muted-foreground">
              Including the ones where the honest answer is no.
            </p>
          </div>
        </Reveal>

        <div className="rounded-xl border border-border bg-surface/50 px-6 py-2 sm:px-8">
          {FAQ.map((f, i) => (
            <FaqRow key={f.q} q={f.q} a={f.a} index={i} />
          ))}
        </div>
      </div>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mx-auto max-w-6xl px-6 pt-20 sm:px-8">
        <Reveal>
          <div className="grid gap-10 pb-16 sm:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="mb-3 text-[15px] font-semibold tracking-tight">
                pagehaul
              </div>
              <p className="max-w-xs text-[13.5px] leading-relaxed text-muted-foreground">
                Every asset on any page, one click away. Built for people tired of
                the Network tab.
              </p>
            </div>

            <div>
              <div className="label-mono mb-4">Product</div>
              <ul className="space-y-2.5 text-[13.5px] text-muted-foreground">
                <li>
                  <a href="#top" className="transition-colors hover:text-foreground">
                    Scan a page
                  </a>
                </li>
                <li className="opacity-50">Browser extension, soon</li>
              </ul>
            </div>

            <div>
              <div className="label-mono mb-4">More</div>
              <ul className="space-y-2.5 text-[13.5px] text-muted-foreground">
                <li>
                  <a
                    href="https://github.com/G-the-dev/pagehaul"
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-foreground"
                  >
                    GitHub
                  </a>
                </li>
                <li className="opacity-50">
                  &copy; {new Date().getFullYear()}
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Oversized wordmark, faded at the baseline so it reads as a mark. */}
      <div aria-hidden className="select-none px-4" style={{ lineHeight: 0.76 }}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1, ease: EASE }}
          className="bg-gradient-to-b from-foreground/60 via-foreground/18 to-transparent bg-clip-text text-center text-[clamp(3.5rem,18vw,16rem)] font-semibold tracking-[-0.05em] text-transparent"
        >
          pagehaul
        </motion.div>
      </div>
    </footer>
  );
}
