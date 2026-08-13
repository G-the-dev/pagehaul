"use client";

import { useState } from "react";

/** Small structural bracket used to frame technical surfaces. */
function Corners({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {[
        "left-0 top-0 border-l border-t",
        "right-0 top-0 border-r border-t",
        "left-0 bottom-0 border-b border-l",
        "right-0 bottom-0 border-b border-r",
      ].map((pos) => (
        <span key={pos} className={`absolute h-2.5 w-2.5 border-accent/45 ${pos}`} />
      ))}
    </span>
  );
}

interface Props {
  url: string;
  setUrl: (v: string) => void;
  deep: boolean;
  setDeep: (v: boolean) => void;
  onScan: () => void;
  error: string | null;
  onRetry: () => void;
}

const FINDS = [
  { k: "Images", v: "JPG · PNG · WebP · AVIF · GIF" },
  { k: "Vectors", v: "SVG files, sprites, inline icons" },
  { k: "Video", v: "MP4 · WebM, posters, captions" },
  { k: "Fonts", v: "WOFF2 with real family names" },
  { k: "Documents", v: "PDF · DOCX · XLSX · CSV" },
  { k: "Hidden", v: "srcset sizes, CSS backgrounds" },
];

const STEPS = [
  {
    n: "01",
    h: "Paste a link",
    p: "Any public page. We read the markup, the stylesheets and the data embedded in the page to find every file it references.",
  },
  {
    n: "02",
    h: "See it all at once",
    p: "Real previews in one grid — with readable names, formats and sizes. Not a folder of hashes.",
  },
  {
    n: "03",
    h: "Take what you want",
    p: "One click for one file. Or pick a set and get a tidy archive. Nothing to unzip and search.",
  },
];

export function Landing({
  url,
  setUrl,
  deep,
  setDeep,
  onScan,
  error,
  onRetry,
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Quiet technical backdrop: grid, faded at the edges, with one soft bloom. */}
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_20%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[100px]"
          style={{ background: "var(--accent)" }}
        />

        <div className="relative mx-auto max-w-[1200px] px-6 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-[860px] text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <span className="label-mono text-[10px] text-fg-2">
                Renders JavaScript · finds what DevTools finds
              </span>
            </div>

            <h1 className="text-[2.6rem] font-semibold leading-[1.02] sm:text-[4.25rem]">
              Every asset on any page,
              <br className="hidden sm:block" />{" "}
              <span className="text-muted-foreground">one click away.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-[560px] text-pretty text-[15px] leading-relaxed text-fg-2 sm:text-[17px]">
              Stop opening the Network tab. Stop downloading a 40&nbsp;MB archive to
              find one logo. Paste a link, see everything the page is made of, take
              exactly what you need.
            </p>

            {/* input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (url.trim()) onScan();
              }}
              className="mx-auto mt-10 max-w-[620px]"
            >
              <div
                className={`relative rounded-xl border bg-surface p-1.5 transition-all duration-200 ${
                  focused
                    ? "border-accent-line shadow-[0_0_0_4px_var(--accent-soft)]"
                    : "border-border shadow-soft"
                }`}
              >
                <div className="flex flex-col gap-1.5 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2.5 px-3">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
                      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
                    </svg>
                    <input
                      type="text"
                      inputMode="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="stripe.com"
                      aria-label="Website link"
                      className="w-full bg-transparent py-3 text-[15px] outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Scan page
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeep(!deep)}
                aria-pressed={deep}
                className="group mt-3.5 inline-flex items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors"
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                    deep ? "border-accent bg-accent" : "border-border-strong"
                  }`}
                >
                  {deep && (
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5 text-accent-fg"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.8" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] text-fg-2 group-hover:text-foreground">
                  <span className="font-medium text-foreground">Deep scan</span> — opens
                  the page in a real browser and scrolls it. Slower, finds far more.
                </span>
              </button>
            </form>

            {error && (
              <div className="mx-auto mt-6 max-w-[620px] rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-left">
                <p className="text-sm font-medium text-danger">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="label-mono mt-1.5 text-danger underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            <p className="mt-6 text-[13px] text-muted-foreground">
              No account. Nothing stored on our servers.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- steps ---------------- */}
      <section className="mx-auto max-w-[1200px] px-6 py-20 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-surface p-7">
              <div className="label-mono mb-4 text-accent">{s.n}</div>
              <h3 className="mb-2 text-[17px] font-semibold">{s.h}</h3>
              <p className="text-[14px] leading-relaxed text-fg-2">{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- what it finds ---------------- */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24 sm:px-8">
        <div className="relative rounded-2xl border border-border bg-surface p-8 shadow-soft sm:p-12">
          <Corners />
          <div className="mb-10 max-w-[520px]">
            <div className="label-mono mb-4 text-accent">Coverage</div>
            <h2 className="text-[1.9rem] font-semibold leading-tight sm:text-[2.4rem]">
              It finds the files a right-click cannot.
            </h2>
            <p className="mt-3.5 text-[15px] leading-relaxed text-fg-2">
              Background images defined in CSS. Every size in a{" "}
              <code className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
                srcset
              </code>
              . Fonts buried in stylesheets. Images that only exist inside a
              JavaScript payload until the page runs.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FINDS.map((f) => (
              <div key={f.k} className="bg-surface p-5">
                <div className="mb-1.5 text-[14px] font-semibold">{f.k}</div>
                <div className="font-mono text-[12px] leading-relaxed text-muted-foreground">
                  {f.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- honest limits ---------------- */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24 sm:px-8">
        <div className="rounded-2xl border border-border bg-surface-2/50 p-8 sm:p-10">
          <div className="label-mono mb-4">What it will not do</div>
          <div className="grid gap-8 sm:grid-cols-2">
            <p className="text-[15px] leading-relaxed text-fg-2">
              Pages behind a login stay closed. X, Instagram and Facebook only serve
              their media to signed-in sessions, so an automated browser sees the
              shell and nothing more.
            </p>
            <p className="text-[15px] leading-relaxed text-fg-2">
              When that happens pagehaul says so, rather than handing back an empty
              result and calling it a success. A browser extension that carries your
              own session is the fix, and it is not built yet.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
