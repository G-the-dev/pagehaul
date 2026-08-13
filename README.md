# pagehaul

**Paste any link. Haul exactly the assets you need.**

Every image, icon, SVG, video, font and document on a page — in one filterable grid.
Take a single file or all of them. No ZIP to unpack, no hunting through folders,
no opening the browser's Network tab.

---

## The architecture, in one paragraph

**The backend never touches asset bytes.** It loads the page once, reads the HTML and
its stylesheets, and returns a JSON *manifest* — a list of asset URLs plus their
metadata. The browser then fetches the actual files straight from the origin server
when the user downloads them, and builds any ZIP client-side.

That is the whole cost model. A scan of a 40 MB site pushes about 2 MB through our
server instead of 80 MB, and stores nothing at all.

```
                    ┌────────────────────────┐
  user ──url──────▶ │  /api/scan             │
                    │  fetch HTML + CSS      │──── ~2 MB in
                    │  parse, resolve, HEAD  │
                    └───────────┬────────────┘
                                │ ~200 KB of JSON
                                ▼
                    ┌────────────────────────┐
                    │  browser               │
                    │  grid · filters        │
                    │  select · zip          │
                    └───────────┬────────────┘
                                │ fetches files DIRECT from origin
                                ▼
                         the original site
```

### Download paths

Browsers block *reading the bytes* of a cross-origin file unless the origin allows it.
They do **not** block *displaying* it — so previews always work, even when downloads
cannot. Three paths, in order:

| Path | What happens | Cost to us |
| --- | --- | --- |
| **A — direct** | `fetch` → blob → download with a proper filename | nothing |
| **C — open** | Source refused the read, so open it in a tab to save manually | nothing |
| **B — relay** | *Not built yet.* A streaming pass-through for blocked files | one request |

Path B is deliberately deferred until real usage shows how often it is needed.

---

## What it extracts

Everything below comes from a static read of the HTML and CSS — no headless browser,
so a scan costs a single page fetch and runs in a couple of seconds.

- **Images** — `<img>`, every `srcset` and `<picture>` variant, lazy-load attributes
  (`data-src`, `data-srcset`, `data-original`), CSS `url()` backgrounds, inline
  `style` backgrounds, favicons, apple-touch-icons, Open Graph and Twitter images
- **SVG** — linked files, sprite sheets, and inline `<svg>` serialised to a data URL
- **Video / audio** — `<video>`, `<audio>`, every `<source>`, poster frames, caption tracks
- **Fonts** — `@font-face` sources pulled out of fetched stylesheets
- **Documents** — PDF, Office formats, CSV, JSON, XML and archives found in links
- **Code** — stylesheets and scripts

Each asset carries: format, byte size (via `HEAD`, no body downloaded), dimensions
where declared, alt text, the page it came from, a rough section (`hero`, `nav`,
`header`, `footer`, `main`), first- vs third-party origin, and srcset family grouping.

### Two details worth knowing

**Preview small, download large.** Tiles render the *smallest* known `srcset` variant.
A 400 px thumbnail is ~20 KB where the original is ~300 KB — so a 400-image grid costs
a fraction of what it looks like. The full-resolution file is what actually downloads.

**"Largest version only" is on by default.** Without it a single `srcset` family shows
as four near-identical tiles and the grid looks broken.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run start
```

No environment variables, no database, no object storage. That is intentional.

### API

```
POST /api/scan
{ "url": "stripe.com", "depth": 1 }
```

`depth: 1` reads the given page. `depth: 2` also follows same-origin links, capped at
12 pages. Returns `{ target, pages[], assets[], ms, notes[] }`.

Submitted URLs are checked against private, loopback and link-local ranges before any
fetch, so the endpoint cannot be used to probe internal network space.

---

## Status

Working V1: scan, filter, preview, select, download one file or many.

**Deliberately not built yet** — deep scan with a headless browser (for lazy-loaded and
script-injected images), the relay path, HLS/DASH video muxing, format conversion on
download, capture history, and the browser extension for logged-in pages.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · cheerio for parsing ·
fflate for client-side ZIP.
