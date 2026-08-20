"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { EASE, Reveal, Section, Chip } from "./ui/motion-primitives";
import { SITE } from "@/lib/site";
import { FooterWordmark } from "./FooterWordmark";

/**
 * Ordered the way a first time visitor actually asks: what does it cost, is it
 * safe, then the two troubleshooting questions that otherwise become support
 * mail, then the licence question nobody else answers honestly.
 */
const FAQ = [
  {
    q: "Is it free?",
    a: "Quick scans are free and unlimited, and you get 2 free deep scans. Past that it is ₹199 a month, or a ₹99 pack of 15 deep scans.",
  },
  {
    q: "Do you keep my files or scans?",
    a: "No. Your browser fetches files straight from the original site and builds any archive locally. We keep no history.",
  },
  {
    q: "It only found a handful of files. Why?",
    a: "You ran a quick scan on a page built with JavaScript. Switch to deep, which runs the page in a real browser and usually finds three to four times as much.",
  },
  {
    q: "Does it work on X or Instagram?",
    a: "Instagram public profiles, yes. X, no. X serves media only to signed in sessions, and we say so rather than handing back nothing.",
  },
  {
    q: "What does it find?",
    a: "Images and every srcset size, SVG icons, video, fonts, documents, scripts, and the API calls a page makes. Deep scans also read its palette and type.",
  },
  {
    q: "A file would not download.",
    a: "Some servers refuse to let another site read their files. We open those in a new tab so you can save them yourself.",
  },
  {
    q: "Can I use what I download?",
    a: "Downloading gives you no rights to a file. Fonts, images and video carry licences. Built for sites you own, migrations, backups and reference.",
  },
];

/**
 * One row may be open at a time, and the state lives in the parent so opening
 * one closes the last. Each row owning its own state is what let them stack up
 * into a wall of text.
 */
function FaqRow({
  q,
  a,
  index,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Reveal delay={index * 0.04}>
      <div className="border-b border-border/50 last:border-b-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="group flex w-full items-center justify-between gap-6 py-4 text-left"
        >
          <span
            className={`text-[16px] font-medium leading-snug transition-colors ${
              open ? "text-foreground" : "text-fg-2 group-hover:text-foreground"
            }`}
          >
            {q}
          </span>
          <motion.span
            animate={{ rotate: open ? 45 : 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-border-strong group-hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="max-w-xl pb-5 pr-10 text-[15px] leading-relaxed text-muted-foreground">
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
  // Nothing is open to begin with, so the section reads as a list of questions
  // rather than an essay.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <Chip>FAQ</Chip>
            <h2 className="mt-6 text-[2.15rem] font-medium leading-[1.12] tracking-tight sm:text-[2.7rem]">
              Your questions,
              <br />
              answered plainly.
            </h2>
            <p className="mt-5 max-w-xs text-[15.5px] leading-relaxed text-muted-foreground">
              Including the ones where the honest answer is no.
            </p>
          </div>
        </Reveal>

        <div className="rounded-xl border border-border bg-surface/50 px-6 py-2 sm:px-8">
          {FAQ.map((f, i) => (
            <FaqRow
              key={f.q}
              q={f.q}
              a={f.a}
              index={i}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

/**
 * A full-bleed band of hairline diagonal stripes, the drafting-paper filler
 * between sections. Structure without content: the page admits it is built,
 * the way the tile logo admits it is pixels.
 */
export function HatchBand() {
  return <div aria-hidden className="hatch h-10 w-full border-y border-border/60" />;
}

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Content and wordmark share one container and one padding value, so
          their left and right edges line up. They were on different wrappers
          before, which is why nothing aligned. */}
      <div className="mx-auto max-w-6xl px-6 pt-20 sm:px-8">
        <Reveal>
          <div className="grid gap-10 pb-20 sm:grid-cols-[1fr_auto_auto] sm:gap-x-24">
            <div>
              <div className="mb-3 text-[16px] font-semibold tracking-tight">
                pagehaul
              </div>
              <p className="max-w-[26ch] text-[14.5px] leading-relaxed text-muted-foreground">
                Every asset on any page, one click away.
              </p>
              {/* Directory badge — kept quiet on purpose: dimmed until
                  hovered, sized by the badge itself. The rel value is what
                  their verifier looks for; leave it as issued. */}
              <a
                href="https://maidensail.com/startup/pagehaul"
                rel="dofollow"
                className="mt-5 inline-block opacity-60 transition-opacity hover:opacity-100"
              >
                <img
                  src="https://maidensail.com/badge/pagehaul.svg"
                  alt="Featured on Maidensail"
                  height={36}
                  className="h-9 w-auto"
                />
              </a>
            </div>

            <div>
              <div className="label-mono mb-4">Product</div>
              <ul className="space-y-2.5 text-[14.5px] text-muted-foreground">
                <li>
                  <a href="#top" className="transition-colors hover:text-foreground">
                    Scan a page
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="transition-colors hover:text-foreground">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/about" className="transition-colors hover:text-foreground">
                    About
                  </Link>
                </li>
                <li className="opacity-50">Browser extension, soon</li>
              </ul>
            </div>

            <div>
              <div className="label-mono mb-4">More</div>
              <ul className="space-y-2.5 text-[14.5px] text-muted-foreground">
                <li>
                  <Link href="/privacy" className="transition-colors hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition-colors hover:text-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="transition-colors hover:text-foreground">
                    Contact
                  </Link>
                </li>
                <li className="opacity-50">Open source soon</li>
              </ul>
            </div>
          </div>
        </Reveal>

        <FooterWordmark />
      </div>
    </footer>
  );
}
