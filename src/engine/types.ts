/**
 * Shared shapes for the engine. Kept deliberately small: only what step 1
 * actually needs, so nothing here is speculative.
 */

/**
 * How the crawler identifies itself. Being honest about who we are is both the
 * decent thing to do and what lets a site owner contact us instead of just
 * blocking us. Replace the URL before this ships anywhere real.
 */
export const USER_AGENT =
  "pagehaul/0.1 (+https://pagehaul.example/bot; site downloader)";

/** A single progress update. The CLI prints these; the web layer can consume them later. */
export interface Progress {
  /** Pages discovered so far. */
  pagesFound: number;
  /** Pages fully rendered. */
  pagesDone: number;
  /** Assets downloaded. */
  assetsDone: number;
  /** Total bytes written. */
  bytes: number;
  /** Non fatal problems. A 404 belongs here, not in a thrown error. */
  errors: string[];
  /** What the engine is doing right now, for a status line. */
  current?: string;
}

export type ProgressCallback = (p: Progress) => void;

/** The result of rendering one page in a real browser. */
export interface RenderedPage {
  /** The URL we asked for. */
  requestedUrl: string;
  /** Where we actually ended up, after any redirects. */
  finalUrl: string;
  /** HTTP status of the main document. */
  status: number;
  /** The DOM after JavaScript has run, which is the point of using a browser. */
  html: string;
  /** Document title, handy for logging. */
  title: string;
  /** Every URL the page requested while loading. Step 2 will use this. */
  requestedResources: string[];
  /** How long the render took, in milliseconds. */
  ms: number;
}

export interface RenderOptions {
  /** Give up on a single page after this long. */
  timeoutMs?: number;
  /** Viewport width and height. Affects which responsive images load. */
  viewport?: { width: number; height: number };
  /** Scroll the page in steps before capture, so lazy content loads. */
  autoScroll?: boolean;
  onProgress?: ProgressCallback;
}
