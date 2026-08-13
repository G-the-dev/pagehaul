import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pagehaul — take exactly the assets you need from any page",
  description:
    "Paste a link and get every image, icon, video, font and document on the page in one filterable grid. Download one file or all of them — no hunting through a ZIP.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
