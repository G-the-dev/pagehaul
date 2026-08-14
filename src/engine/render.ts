import { chromium, type Browser, type Page } from "playwright";
import { assertSafeToFetch, parseTargetUrl, UnsafeUrlError } from "./safety.js";
import { USER_AGENT, type RenderedPage, type RenderOptions } from "./types.js";

/**
 * Renders one page in a real headless browser.
 *
 * Why a browser at all: a huge share of sites build their markup with
 * JavaScript. Fetching the HTML with plain HTTP on those gives you an empty
 * shell with a <div id="root"></div> and nothing inside it. Running the page in
 * Chromium gives us the DOM as a person would actually see it.
 *
 * We also record every URL the page requests while loading. That list is how
 * step 2 will know what to download, and it is more reliable than parsing the
 * HTML, because it includes things only discoverable at runtime.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

/** Opens a browser. The caller closes it, so one browser can render many pages. */
export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"],
  });
}

/**
 * Scrolls to the bottom in steps, pausing at each one.
 *
 * Lazy loading works by watching what is near the viewport, so a page that is
 * never scrolled never loads most of its images. Jumping straight to the bottom
 * does not work either, because the images in between are skipped. Stepping is
 * what actually triggers them.
 */
async function scrollThroughPage(page: Page): Promise<void> {
  // Passed as a string on purpose. The TypeScript build injects small helper
  // functions into compiled code, and those helpers do not exist inside the
  // browser, so a function passed here would fail with "__name is not defined".
  // A string is handed to the page verbatim and sidesteps that entirely.
  await page.evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.round(window.innerHeight * 0.8);
    let last = -1;

    for (let i = 0; i < 40; i++) {
      window.scrollBy(0, step);
      await sleep(220);

      const height = document.body.scrollHeight;
      const atBottom = window.scrollY + window.innerHeight >= height - 50;

      // Stop once we reach the bottom and the page has stopped growing.
      // Infinite scroll pages keep growing, and the loop cap catches those.
      if (atBottom && height === last) break;
      if (atBottom) last = height;
    }

    window.scrollTo(0, 0);
    await sleep(200);
  })()`);
}

export async function renderPage(
  rawUrl: string,
  browser: Browser,
  options: RenderOptions = {},
): Promise<RenderedPage> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;

  // Cheap checks first, then DNS. Throws if the URL is not safe to fetch.
  const target = parseTargetUrl(rawUrl);
  await assertSafeToFetch(target);

  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport,
    // Chromium ignores certificate problems by default in some setups; being
    // explicit means a broken certificate fails loudly rather than silently.
    ignoreHTTPSErrors: false,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  const requestedResources = new Set<string>();

  // Record what the page asks for. This becomes the download list in step 2.
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith("http://") || u.startsWith("https://")) {
      requestedResources.add(u);
    }
  });

  // A redirect can move us from a public host to a private one, so every
  // navigation the page makes gets re-checked rather than trusting the first.
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 300 && status < 400) {
      const location = res.headers()["location"];
      if (!location) return;
      try {
        const next = new URL(location, res.url());
        // Fire and forget: if this is unsafe we close the page immediately.
        assertSafeToFetch(next).catch(() => {
          void page.close().catch(() => {});
        });
      } catch {
        /* an unparseable Location is not our problem to fix */
      }
    }
  });

  try {
    const response = await page.goto(target.toString(), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // The final URL may differ from the requested one after redirects, so
    // validate where we actually landed.
    const finalUrl = page.url();
    const landed = parseTargetUrl(finalUrl);
    await assertSafeToFetch(landed);

    options.onProgress?.({
      pagesFound: 1,
      pagesDone: 0,
      assetsDone: 0,
      bytes: 0,
      errors: [],
      current: `Rendering ${finalUrl}`,
    });

    // Let the first burst of requests settle before scrolling.
    await page
      .waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 15_000) })
      .catch(() => {
        /* some pages poll forever and never go idle; that is fine */
      });

    if (options.autoScroll !== false) {
      await scrollThroughPage(page);
      // Scrolling triggers a second wave of requests. Wait for those too.
      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => {});
    }

    const html = await page.content();
    const title = await page.title().catch(() => "");

    return {
      requestedUrl: target.toString(),
      finalUrl,
      status: response?.status() ?? 0,
      html,
      title,
      requestedResources: [...requestedResources],
      ms: Date.now() - started,
    };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not render ${target.toString()}: ${message}`);
  } finally {
    await context.close().catch(() => {});
  }
}
