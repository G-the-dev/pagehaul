"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
    q: "How do I download all images from a website at once?",
    a: "Paste the address and scan. Every image on the page appears in one grid, original files at full quality, and you can take one or select them all as a zip.",
  },
  {
    q: "Why are some images missing or not downloadable?",
    a: "A quick scan reads only the markup, so anything drawn by JavaScript needs a deep scan, which runs the page in a real browser. A few sites also refuse direct downloads; those open in a new tab so you can save them yourself.",
  },
  {
    q: "How do I save an SVG file from a website?",
    a: "SVG icons, including inline ones that never exist as files, are collected under the Icons tab. Download them as files, or copy one as source and paste it straight into Figma or your editor.",
  },
  {
    q: "What font does this website use, and can I download it?",
    a: "The Fonts tab lists every typeface the page loads under its real family name, and the files download like anything else. Whether you may use a font is a licence question the download does not answer.",
  },
  {
    q: "How do I get a website's color palette?",
    a: "Run a deep scan and open the Design tab: the palette as the page paints it, its typography, and its design tokens, ready for Figma or CSS.",
  },
  {
    q: "Can I download 3D models from a website?",
    a: "Yes. Deep scans collect GLB and glTF models, including ones three.js sites assemble at runtime, with previews before you download.",
  },
  {
    q: "Does it work on dynamic or lazy-loaded pages?",
    a: "That is what deep scan exists for: it runs the page in a real browser and scrolls it, so lazy images and script-built content actually appear.",
  },
  {
    q: "Is it legal to download images from a website?",
    a: "Downloading gives you no rights to a file. Images, fonts and video usually carry licences. Built for sites you own, migrations, backups and reference.",
  },
  {
    q: "Do you keep my files or scans?",
    a: "No. Your browser fetches files straight from the original site and builds any archive locally. We keep no history.",
  },
  {
    q: "Is it free?",
    a: "Quick scans are free and unlimited, and you get 2 free deep scans. Past that it is $2.99 a month, or a $1.49 pack of 5 deep scans.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes, with a phone-sized flow: pick the kinds of files you want and take the zip. The full grid with previews is best on a desktop.",
  },
  {
    q: "Does it work on X or Instagram?",
    a: "Instagram public profiles, yes. X, no. X serves media only to signed in sessions, and we say so rather than handing back nothing.",
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
        {/* No open/close animation at all, by request: the answer is either
            there or it is not, and a clean cut cannot jitter. */}
        {open && (
          <p className="max-w-xl pb-5 pr-10 text-[15px] leading-relaxed text-muted-foreground">
            {a}
          </p>
        )}
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
 * The one stretch of plain prose on the landing page, written for the
 * person who arrived from a search and wants the specifics: what formats
 * come out, how the zip works, what happens on JavaScript-built pages.
 */
export function Formats() {
  return (
    <Section id="formats">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <Chip>The specifics</Chip>
            <h2 className="mt-6 text-[2.15rem] font-medium leading-[1.12] tracking-tight sm:text-[2.7rem]">
              Every format,
              <br />
              spelled out.
            </h2>
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="space-y-8 text-[15px] leading-[1.75] text-fg-2">
            <div>
              <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">
                What a scan extracts
              </h3>
              <p>
                Images in JPG, PNG, WebP, AVIF and GIF, with every srcset size
                the page declares. SVG icons, including inline ones that never
                exist as files. Fonts as WOFF2, WOFF and TTF under their real
                family names. Video and audio in MP4, WebM and MP3. Documents,
                scripts, JSON payloads, and 3D models in GLB and glTF. Deep
                scans add full-page and per-section screenshots, plus the color
                palette, typography and design tokens read off the painted
                page.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">
                One file, or the whole page as a zip
              </h3>
              <p>
                Click a file and it downloads alone, named like a person would
                name it. Select a set and it arrives as one zip, organised
                into folders by kind with a manifest, built by your own
                browser so nothing you take ever sits on a server.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-[17px] font-semibold tracking-tight text-foreground">
                JavaScript pages, lazy loading, single-page apps
              </h3>
              <p>
                Most of the web draws itself after the markup arrives, which
                is why right-click and view-source miss so much. A deep scan
                runs the page in a real browser and scrolls it end to end, so
                lazy-loaded images, script-built galleries and WebGL scenes
                give up their files like any other page.
              </p>
            </div>
          </div>
        </Reveal>
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
              <a
                href={SITE.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="pagehaul on X"
                className="mt-5 inline-grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Directory badge — kept quiet on purpose: dimmed until
                  hovered, sized by the badge itself. The rel value is what
                  their verifier looks for; leave it as issued. */}
              <a
                href="https://maidensail.com/startup/pagehaul"
                rel="dofollow"
                className="mt-4 block w-fit opacity-60 transition-opacity hover:opacity-100"
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
                  <a href="/#pricing" className="transition-colors hover:text-foreground">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/image-downloader" className="transition-colors hover:text-foreground">
                    Image downloader
                  </Link>
                </li>
                <li>
                  <Link href="/website-downloader" className="transition-colors hover:text-foreground">
                    Website downloader
                  </Link>
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
