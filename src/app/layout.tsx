import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const appSans = Inter({
  subsets: ["latin"],
  variable: "--font-app-sans",
  display: "swap",
});

/**
 * ABC Diatype Mono, from the owner's own licensed files. One weight is all
 * the mono seats need; the few tiny labels that ask for bold synthesize it.
 */
const appMono = localFont({
  src: "./fonts/ABCDiatypeMono.woff2",
  weight: "400",
  variable: "--font-app-mono",
  display: "swap",
});

/**
 * Applies the stored theme before anything paints.
 *
 * This has to run as a blocking inline script rather than in a component,
 * because a component runs after first paint and the page would flash the
 * wrong theme first.
 *
 * Both classes are managed together. Our own tokens key off .light, but the
 * shadcn components use dark: variants that key off .dark, so leaving one
 * behind would half apply the theme.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    var light = stored ? stored === "light" : prefersLight;
    var root = document.documentElement;
    root.classList.toggle("light", light);
    root.classList.toggle("dark", !light);
    root.style.colorScheme = light ? "light" : "dark";
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL("https://pagehaul.vercel.app"),
  title: "Website Asset Extractor: Download Images, SVGs, Fonts, Videos from Any URL · pagehaul",
  description:
    "Paste any URL and download every image, SVG icon, font, video, audio file and 3D model on the page. Previews, real names, one-click zips. Free, no signup.",
  keywords: [
    "website asset extractor",
    "image downloader",
    "website downloader",
    "download images from website",
    "extract fonts from website",
    "website scanner",
    "download website assets",
    "extract svg icons",
    "web design assets",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "pagehaul: every asset on any page",
    description:
      "Paste any URL and download every image, SVG icon, font, video, audio file and 3D model on the page. Free, no signup.",
    url: "/",
    siteName: "pagehaul",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "pagehaul: every asset on any page",
    description:
      "Paste any URL and download every image, SVG icon, font, video, audio file and 3D model on the page. Free, no signup.",
  },
  robots: { index: true, follow: true },
};

/**
 * Structured data: the application with its plans, and the FAQ, so search
 * results can show prices and answers directly. Mirrors the visible page;
 * when the FAQ or prices change there, change them here.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "pagehaul",
      url: "https://pagehaul.vercel.app",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web browser",
      description:
        "Paste a link and get every image, icon, video, font and document on the page in one grid.",
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        {
          "@type": "Offer",
          name: "Pro, one month",
          price: "2.99",
          priceCurrency: "USD",
        },
        {
          "@type": "Offer",
          name: "Scan pack, 5 deep scans",
          price: "1.49",
          priceCurrency: "USD",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How do I download all images from a website at once?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Paste the address into pagehaul and scan. Every image on the page appears in one grid, original files at full quality, and you can take one or select them all as a zip.",
          },
        },
        {
          "@type": "Question",
          name: "Why are some images missing or not downloadable?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A quick scan reads only the markup, so anything drawn by JavaScript needs a deep scan, which runs the page in a real browser. A few sites also refuse direct downloads; those open in a new tab so you can save them yourself.",
          },
        },
        {
          "@type": "Question",
          name: "Is it legal to download images from a website?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Downloading gives you no rights to a file. Images, fonts and video usually carry licences. pagehaul is built for sites you own, migrations, backups and reference.",
          },
        },
        {
          "@type": "Question",
          name: "How do I save an SVG file from a website?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "SVG icons, including inline ones that never exist as files, are collected under the Icons tab. Download them as files, or copy one as source and paste it straight into Figma or your editor.",
          },
        },
        {
          "@type": "Question",
          name: "What font does this website use, and can I download it?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Fonts tab lists every typeface the page loads under its real family name, and the files download like anything else. Whether you may use a font is a licence question the download does not answer.",
          },
        },
        {
          "@type": "Question",
          name: "How do I get a website's color palette?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Run a deep scan and open the Design tab: the palette as the page paints it, its typography, and its design tokens, ready for Figma or CSS.",
          },
        },
        {
          "@type": "Question",
          name: "Can I download 3D models from a website?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Deep scans collect GLB and glTF models, including ones three.js sites assemble at runtime, with previews before you download.",
          },
        },
        {
          "@type": "Question",
          name: "Does it work on dynamic or lazy-loaded pages?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "That is what deep scan exists for: it runs the page in a real browser and scrolls it, so lazy images and script-built content actually appear.",
          },
        },
        {
          "@type": "Question",
          name: "Do you keep my files or scans?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Your browser fetches files straight from the original site and builds any archive locally. We keep no history.",
          },
        },
        {
          "@type": "Question",
          name: "Is it free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Quick scans are free and unlimited, and you get 2 free deep scans. Past that it is $2.99 a month, or a $1.49 pack of 5 deep scans.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark is the server rendered default. The script above corrects it before
    // paint for anyone who prefers light.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${appSans.variable} ${appMono.variable} antialiased`}>
        {children}
        {/* Vercel Web Analytics — anonymous page views and visitor counts, no
            cookies. It quietly does nothing when the site is not on Vercel, so
            local dev is unaffected. */}
        <Analytics />
      </body>
    </html>
  );
}
