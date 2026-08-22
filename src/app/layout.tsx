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
  title: "pagehaul, every asset on any page",
  description:
    "Paste a link and get every image, icon, video, font and document on the page in one grid. Take a single file or all of them. No DevTools, no archive to dig through.",
  keywords: [
    "website asset extractor",
    "download images from website",
    "extract fonts from website",
    "website scanner",
    "download website assets",
    "extract svg icons",
    "web design assets",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "pagehaul, every asset on any page",
    description:
      "Paste a link and get every image, icon, video, font and document on the page in one grid.",
    url: "/",
    siteName: "pagehaul",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "pagehaul, every asset on any page",
    description:
      "Paste a link and get every image, icon, video, font and document on the page in one grid.",
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
          name: "Is it free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Quick scans are free and unlimited, and you get 2 free deep scans. Past that it is $2.99 a month, or a $1.49 pack of 5 deep scans.",
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
          name: "What does it find?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Images and every srcset size, SVG icons, video, fonts, documents, scripts, and the API calls a page makes. Deep scans also read its palette and type.",
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
