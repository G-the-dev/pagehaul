/**
 * The command line entry point.
 *
 * Step 1 scope: fetch and render a single page, then report what came back.
 * Downloading assets, rewriting links and crawling further pages come later.
 *
 * Run it with:
 *   npx tsx src/cli.ts https://example.com
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { launchBrowser, renderPage } from "./engine/render.js";
import { UnsafeUrlError } from "./engine/safety.js";

interface Args {
  url: string;
  out: string;
  depth: number;
  maxPages: number;
  timeoutMs: number;
  noScroll: boolean;
  help: boolean;
}

/**
 * A small hand written parser rather than a library. There are only a handful
 * of flags, and this keeps the dependency list short and the behaviour obvious.
 */
function parseArgs(argv: string[]): Args {
  const args: Args = {
    url: "",
    out: "./output",
    depth: 1,
    maxPages: 25,
    timeoutMs: 30_000,
    noScroll: false,
    help: false,
  };

  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];

    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--out") args.out = next() ?? args.out;
    else if (a === "--depth") args.depth = Number(next() ?? args.depth);
    else if (a === "--max-pages") args.maxPages = Number(next() ?? args.maxPages);
    else if (a === "--timeout") args.timeoutMs = Number(next() ?? args.timeoutMs) * 1000;
    else if (a === "--no-scroll") args.noScroll = true;
    else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    } else rest.push(a);
  }

  args.url = rest[0] ?? "";
  return args;
}

const HELP = `
pagehaul  ·  downloads a website you can open offline

Usage
  npx tsx src/cli.ts <url> [options]

Options
  --out <dir>         Where to write output       (default ./output)
  --depth <n>         How many links deep to go   (default 1)
  --max-pages <n>     Hard cap on pages           (default 25)
  --timeout <sec>     Per page timeout            (default 30)
  --no-scroll         Skip the lazy load scroll pass
  -h, --help          Show this

Step 1 renders a single page and reports what it found. Asset download,
link rewriting and multi page crawling arrive in later steps.
`;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.url) {
    console.log(HELP);
    process.exit(args.url ? 0 : 1);
  }

  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });

  console.log(`\n  target   ${args.url}`);
  console.log(`  out      ${outDir}`);
  console.log(`  scroll   ${args.noScroll ? "off" : "on"}\n`);

  const browser = await launchBrowser();

  try {
    const page = await renderPage(args.url, browser, {
      timeoutMs: args.timeoutMs,
      autoScroll: !args.noScroll,
      onProgress: (p) => {
        if (p.current) process.stdout.write(`  ${p.current}\n`);
      },
    });

    // Write the rendered HTML so the result is inspectable straight away.
    const htmlPath = join(outDir, "rendered.html");
    await writeFile(htmlPath, page.html, "utf8");

    // Group the requested resources by extension, which makes it obvious at a
    // glance whether the render actually picked up the page's real content.
    const byKind = new Map<string, number>();
    for (const u of page.requestedResources) {
      let ext = "other";
      try {
        const p = new URL(u).pathname;
        const dot = p.lastIndexOf(".");
        if (dot > 0 && dot > p.lastIndexOf("/")) {
          ext = p.slice(dot + 1).toLowerCase().slice(0, 5);
        }
      } catch {
        /* keep it as other */
      }
      byKind.set(ext, (byKind.get(ext) ?? 0) + 1);
    }

    const top = [...byKind.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

    console.log(`\n  RENDERED`);
    console.log(`  status     ${page.status}`);
    console.log(`  final url  ${page.finalUrl}`);
    console.log(`  title      ${page.title || "(none)"}`);
    console.log(`  html       ${formatBytes(Buffer.byteLength(page.html))}`);
    console.log(`  requests   ${page.requestedResources.length}`);
    console.log(`  took       ${(page.ms / 1000).toFixed(1)}s`);

    console.log(`\n  REQUESTS BY TYPE`);
    for (const [ext, n] of top) {
      console.log(`  ${String(n).padStart(5)}  ${ext}`);
    }

    console.log(`\n  Wrote ${htmlPath}\n`);
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      console.error(`\n  BLOCKED  ${err.message}\n`);
      process.exit(3);
    }
    console.error(`\n  FAILED  ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
