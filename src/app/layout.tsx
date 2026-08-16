import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
  title: "pagehaul, every asset on any page",
  description:
    "Paste a link and get every image, icon, video, font and document on the page in one grid. Take a single file or all of them. No DevTools, no archive to dig through.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark is the server rendered default. The script above corrects it before
    // paint for anyone who prefers light.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* Vercel Web Analytics — anonymous page views and visitor counts, no
            cookies. It quietly does nothing when the site is not on Vercel, so
            local dev is unaffected. */}
        <Analytics />
      </body>
    </html>
  );
}
