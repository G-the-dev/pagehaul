# Performance

What was measured, what changed, and what is still open.

All figures come from a production build (`next build` + `next start`) driven by
headless Chrome on an Apple laptop. "@4x" means CPU throttled to a quarter
speed, which is roughly a mid-range phone. Frame times are real intervals
between animation frames during a programmatic scroll, not synthetic scores.

---

## The complaint

The site felt slow after a scan returned. It did, and the grid was the reason.

## Results grid — 343 assets from a deep scan of stripe.com

|                        | before   | after    |
| ---------------------- | -------- | -------- |
| tiles mounted          | 343      | **42**   |
| DOM nodes              | 4,812    | **882**  |
| scroll @4x, median     | 16.8ms   | **10.0ms** |
| scroll @4x, p90        | 41.8ms   | **18.4ms** |
| scroll @4x, p99        | 66.6ms   | **42.2ms** |
| frames over 50ms       | 8 / 147  | **0 / 147** |
| scroll @1x, p99        | —        | 16.8ms, none dropped |
| CLS while scrolling    | —        | 0.003    |
| filter switch @4x      | 1ms      | 2ms      |
| JS heap                | 10MB     | 10MB     |

### Virtualising alone did nothing

Rendering only the visible rows took p90 from 41.8ms to 41.7ms. The virtualiser
re-renders its row list on every scroll step, so every visible tile rebuilt
anyway — and a list of twenty is as expensive to rebuild as a list of three
hundred if you rebuild it sixty times a second.

The win came from memoising the tile **and** giving it a click handler with a
stable identity. An inline `() => onOpen(a)` in the row would have defeated the
memo, so each cell is its own component holding one callback per asset. Both
halves are required; either alone measures as noise.

## Thumbnails

A screen of 48 tiles, each about 200px wide, was pulling **1.89MB** — including
a 494KB JPEG requested at 2240 pixels. Tiles now ask for a size a tile can use,
touching only knobs the address already exposes and only ever downwards, so the
request can never be for something the service was not already offering. A
refused downscale falls back to the original rather than leaving a blank card.

One screen now costs **0.59MB**, and the largest single thumbnail is 78KB
rather than 494KB.

Guessing the resize knob from its name would have been wrong. Framer's URLs
carry `?width=` and `?height=` that look exactly like a resize request and are
nothing of the kind — they are intrinsic dimensions and the CDN ignores them:

| request                | bytes   |
| ---------------------- | ------- |
| no parameters          | 692,660 |
| `?width=400`           | 692,660 |
| `?scale-down-to=512`   | **35,429** |

So hosts whose knob is not the obvious one are named explicitly in
`src/lib/variants.ts`, with the measurement in the comment.

## Repeat scans

Scan results are cached in the serving instance by address and depth, for five
minutes — shorter than the seven minutes results live in the browser, so a
repeat scan can never return something staler than the copy it replaces.

| second scan of the same page | before | after |
| ---------------------------- | ------ | ----- |
| stripe.com, deep             | 24.58s | **0.01s** |

## Landing page

|                     | before | after |
| ------------------- | ------ | ----- |
| `/` initial JS      | 253.4KB | **240.9KB** |
| `/` LCP             | 1100ms | 1020ms |
| `/` TBT @4x         | 64ms   | **46ms** |
| `/` CLS             | 0      | 0 |
| `/about` initial JS | 177.4KB | 177.4KB |

The preview dialog, file picker, design panel, dissolve canvas and zip library
are separate chunks fetched on use — about 28KB moved behind interactions. None
can be needed by somebody who has just opened the page.

Sections below the fold carry `content-visibility: auto`, so the browser may
skip styling and painting what it cannot see. Anchor targets have
`scroll-margin-top` so a jump to `#faq` lands clear of the fixed nav rather
than underneath it.

### A correction

An earlier report claimed the scanner was being served to every route including
the legal pages. That was a measurement error: counting scripts by initiator
type swept up Next's background route prefetch as though it were blocking load.
The HTML for `/about` never referenced those chunks. The legal pages were
177.4KB before the split and are 177.4KB after, because they never had the
scanner in the first place.

---

## Still open

**42.7KB of animation library in the root bundle.** framer-motion is loaded on
every route, including pages with no animation at all. Removing it means
converting ten components; the reveals and fades are straightforward CSS, but
the FAQ accordion height, the hero's rotating word, the toast and the footer
wordmark spring are genuinely stateful. This is the largest remaining win and
the highest-risk change in the plan.

**The <120KB First Load JS target is not reachable.** react-dom (71.6KB), react
and the Next runtime (38.6KB) come to roughly 110KB before a line of our own
code. Any page with a client component starts above 110KB. The target would
need the landing page to have no interactivity at all.

**Streamed scan progress.** The stage list shown during a deep scan is timed
rather than reported — it does not know what the browser is actually doing.
Server-sent events reporting real stages, and rendering assets as they are
discovered, would make the wait feel shorter without making it shorter. Not
attempted.

**Vercel cold starts and region.** The scan route runs on `nodejs` with
`maxDuration = 120` and no `preferredRegion`. Cold-start latency for a route
that launches Chromium has not been measured in production.

**Lighthouse was not run.** No Lighthouse binary was available in this
environment, so Core Web Vitals were measured directly with PerformanceObserver
(LCP, CLS, long tasks, TBT) rather than scored. The underlying numbers are in
the tables above.

## Things deliberately not done

**Capping concurrent thumbnail loads.** Only about forty tiles mount now, so
requests in flight are already bounded by that. A queue would guard a limit
that already holds.

**Moving work to a Web Worker.** A CPU profile of a throttled scroll put 59% of
the time in `(program)` — browser paint, layout and image decode — and only a
few hundred milliseconds across all our JavaScript combined. There is nothing
worth moving off the main thread.

**Font and layout-shift work.** CLS is already 0 on every route, and the hero's
rotating word already reserves its slot width with invisible siblings. Nothing
to fix.

**Deferring analytics.** None is installed.
