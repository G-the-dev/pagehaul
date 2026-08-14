# pagehaul engine

A command line site downloader. This is the core that everything else wraps, so
it has to be good on its own before any web UI touches it.

**Status: step 1 of 6 complete.** It renders a single page and reports what it
found. Downloading, rewriting and crawling come next.

---

## Try it

```bash
npx tsx src/cli.ts https://example.com
npx tsx src/cli.ts https://vercel.com --out ./output/vercel
npx tsx src/cli.ts --help
```

First run only, to fetch the browser Chromium uses:

```bash
npx playwright install chromium
```

---

## What exists so far

```
src/
  cli.ts              the command you run
  engine/
    safety.ts         decides whether a URL is safe to fetch
    render.ts         runs one page in a real browser
    types.ts          shared shapes, deliberately small
scripts/
  test-safety.ts      checks the SSRF guard blocks what it should
  compare-render.ts   raw HTML vs rendered HTML
  compare-assets.ts   assets in raw HTML vs assets actually requested
```

Four files of real code. Nothing is abstracted ahead of need.

---

## The three decisions in step 1, in plain English

### 1. Why run a browser at all

A plain HTTP fetch gives you the HTML the server sends. On sites built with
JavaScript that is often an empty shell: a single empty `div` and a script tag.
Running the page in Chromium gives you the DOM as a person would see it.

I measured this rather than assuming it. Comparing what you can find by reading
the raw HTML against what the page actually requests when run:

| site | assets in raw HTML | assets requested | gain |
| --- | --- | --- | --- |
| linear.app | 339 | 493 | 1.5x |
| stripe.com | 119 | 172 | 1.4x |
| vercel.com | 80 | 105 | 1.3x |
| wordpress.org | 36 | 44 | 1.2x |

A useful surprise: most marketing sites now render on the server, so the *text*
is similar either way. The gain is in **assets**, which is exactly what a
downloader cares about. Fonts loaded from inside a stylesheet, images swapped in
by a script, and files chosen at runtime never appear in the raw HTML.

That is why `render.ts` records every URL the page requests. That request log,
not the HTML, is the reliable list of what to download in step 2.

### 2. Why scroll before capturing

Lazy loading works by watching what is near the viewport, so a page that is
never scrolled never loads most of its images.

Jumping straight to the bottom does not work either, because everything in
between gets skipped. So we scroll in steps of about 80% of the window height,
pause at each one, and stop when the page stops growing. Infinite scroll pages
never stop growing, so there is a hard cap of 40 steps.

Turn it off with `--no-scroll` when you want speed over completeness.

### 3. Why the safety check resolves DNS

This is the part I would not skip, because getting it wrong is a real hole
rather than a bug.

If we fetch any URL we are handed, someone can point us at an address inside our
own network and read the response through us. The usual target is
`169.254.169.254`, the cloud metadata endpoint, which on many hosts hands out
credentials to anything that asks.

Checking the hostname is not enough, because a perfectly public domain name can
resolve to a private address. So `safety.ts` resolves the name and checks every
address it lands on, rejecting private, loopback, link-local and multicast
ranges, in both IPv4 and IPv6, including IPv6 addresses that wrap an IPv4 one.

A redirect can also move from a public host to a private one, so the check runs
again on where we actually landed, not just where we asked to go.

Check it yourself:

```bash
npx tsx scripts/test-safety.ts
```

```
PASS  allowed  https://example.com
PASS  blocked  http://169.254.169.254/latest/meta-data/
PASS  blocked  http://127.0.0.1:3000
PASS  blocked  http://192.168.1.1
PASS  blocked  http://10.0.0.5
PASS  blocked  http://172.16.4.2
PASS  blocked  http://localhost
PASS  blocked  file:///etc/passwd
PASS  blocked  http://[::1]/
PASS  blocked  http://metadata.google.internal/
PASS  blocked  http://0.0.0.0

11/11 correct
```

---

## One thing that will bite you if you edit render.ts

The scroll code is passed to the browser **as a string**, not as a function.
That looks wrong and it is deliberate.

The TypeScript runner compiles code before running it, and that compilation adds
small helper functions. If you hand Playwright a real function, the compiled
version references a helper that does not exist inside the browser, and the page
fails with `__name is not defined`. Passing a string hands the code over
verbatim and avoids the problem entirely.

---

## Rules this engine will not break

- **Nothing is ever injected into a captured file.** No analytics, no banner, no
  rewritten JavaScript beyond turning URLs into local paths. A competitor was
  caught tampering with downloaded jQuery and it cost them their reputation.
- **The crawler says who it is.** The User-Agent names the project and carries a
  contact URL, so a site owner can reach us rather than just block us. Change
  the placeholder in `types.ts` before this ships anywhere real.
- **One failure never kills a job.** A missing asset is a logged warning.

---

## Still to build

| step | what | state |
| --- | --- | --- |
| 1 | Fetch and render one page | done |
| 2 | Discover and download assets | next |
| 3 | Rewrite links to local paths | |
| 4 | Multi page crawl with depth and page caps | |
| 5 | robots.txt, byte ceilings, job timeout | |
| 6 | CLI ergonomics and progress output | |

Step 3 is the one that decides whether output is actually usable, since a
perfect download with absolute URLs still needs the internet to open.

### Test targets, none of them passing yet

Not done until all five open correctly offline with working fonts, images and
layout: a plain static site, WordPress, a Next.js server rendered site, a client
rendered React SPA, and a Webflow or Framer site.
