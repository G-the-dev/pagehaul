/**
 * The one headless browser this instance runs, shared by every job.
 *
 * Serverless instances serve concurrent requests, and a browser per job is how
 * that dies — two launches race to unpack the binary into /tmp (spawn ETXTBSY)
 * and each survivor costs hundreds of megabytes in a container that has about
 * two thousand. One browser, launched once behind a shared promise, with each
 * job in its own page; a small semaphore caps how many drive it at once.
 *
 * Both the deep scan and the poster route share this, so a scan and the poster
 * captures it feeds never run two browsers side by side.
 */

export type Browser = Awaited<ReturnType<typeof rawLaunch>>;

/**
 * The one browser this instance runs, shared by every scan.
 *
 * Serverless instances serve concurrent requests, and a browser per scan is
 * how that dies. Two launches race to unpack the same binary into /tmp and the
 * second gets "spawn ETXTBSY"; the launches that do win each cost hundreds of
 * megabytes in a container with about two thousand to give, and the kernel
 * settles the difference by killing renderers — which surfaces as "Target
 * closed" and looks like the site's fault.
 *
 * One browser, launched once behind a shared promise, with each scan in its
 * own context, removes the race and the multiplication in one move. Scans that
 * arrive together become tabs, not competitors.
 */
let sharedBrowser: Promise<Browser> | null = null;

/** Scans allowed to drive the browser at once; the rest wait their turn. */
const MAX_CONCURRENT_SCANS = 3;
let running = 0;
const waiting: (() => void)[] = [];

export async function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT_SCANS) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => {
    waiting.push(resolve);
  });
  running++;
}

export function releaseSlot(): void {
  running--;
  waiting.shift()?.();
}

/**
 * A page for one scan, healing a dead browser on the way.
 *
 * Pages are opened in the browser's default context, not an isolated one. The
 * serverless Chromium build refuses to create page targets inside an incognito
 * context — Target closed, instantly, on a freshly launched browser — while
 * default-context pages are the path that has worked in production all along.
 * Scans lose cookie isolation from each other, which for reading public pages
 * costs nothing.
 *
 * The health check is the operation itself: the instance is frozen between
 * requests and Chromium does not survive the freeze, but its socket still
 * reports connected. If the page cannot be opened, the corpse is discarded and
 * a fresh browser gets one more try.
 */
export async function newScanPage() {
  for (let attempt = 0; ; attempt++) {
    const browser = await getBrowser();
    try {
      return await browser.newPage();
    } catch (e) {
      sharedBrowser = null;
      try {
        browser.close().catch(() => {});
      } catch {
        /* already gone */
      }
      if (attempt >= 1) throw e;
    }
  }
}

export async function getBrowser(): Promise<Browser> {
  if (sharedBrowser) {
    try {
      const b = await sharedBrowser;
      if (b.connected) return b;
    } catch {
      /* the last launch failed; try again below */
    }
    sharedBrowser = null;
  }

  sharedBrowser = (async () => {
    // ETXTBSY can still happen against a binary another instance is writing;
    // it clears in well under a second, so it is worth two more tries.
    for (let attempt = 0; ; attempt++) {
      try {
        const b = await rawLaunch();
        b.once("disconnected", () => {
          sharedBrowser = null;
        });
        return b;
      } catch (e) {
        const busy = e instanceof Error && /ETXTBSY|EBUSY/i.test(e.message);
        if (!busy || attempt >= 2) throw e;
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  })();

  try {
    return await sharedBrowser;
  } catch (e) {
    sharedBrowser = null;
    throw e;
  }
}

async function rawLaunch() {
  const puppeteer = (await import("puppeteer-core")).default;

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-blink-features=AutomationControlled",
        // Shared memory in a serverless container is tiny, and Chromium's
        // default is to put its renderer heap there. When it runs out the
        // renderer is killed, which reaches us as "Target closed" and reads
        // like a crash rather than what it is.
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  return puppeteer.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}
