import { createHash } from "node:crypto";

/**
 * Turning a URL into a file path.
 *
 * This is fiddly and worth getting right, because every rewritten link in the
 * output depends on it. Two rules matter most:
 *
 *   1. The same URL must always produce the same path. If it did not, a link
 *      rewritten on one page would not match the file written from another.
 *   2. The path must be safe. A URL can contain "..", a leading slash, a null
 *      byte, or a segment long enough to break the filesystem, and none of
 *      those may be allowed to escape the output directory.
 */

/** Characters no filesystem we care about will accept, plus control codes. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\x00-\x1f<>:"|?*\\]/g;

const MAX_SEGMENT = 100;

/** Makes one path segment safe without changing which URL it came from. */
function safeSegment(raw: string): string {
  let s = decodeURIComponent(raw).replace(UNSAFE, "-").trim();

  // "." and ".." would climb out of the output directory.
  if (s === "." || s === "..") s = "_";

  // A very long name breaks some filesystems, so truncate and add a short hash
  // of the original so two long names never collapse into one.
  if (s.length > MAX_SEGMENT) {
    const h = createHash("sha1").update(s).digest("hex").slice(0, 8);
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 6 ? s.slice(dot) : "";
    s = `${s.slice(0, MAX_SEGMENT - 9 - ext.length)}-${h}${ext}`;
  }

  return s || "_";
}

/**
 * The local path for a URL, relative to the output directory.
 *
 * Examples:
 *   https://a.com/            ->  a.com/index.html
 *   https://a.com/about       ->  a.com/about/index.html   (no extension)
 *   https://a.com/logo.svg    ->  a.com/logo.svg
 *   https://a.com/i.jpg?w=99  ->  a.com/i.jpg              (query kept in hash)
 */
export function urlToLocalPath(rawUrl: string, isDocument = false): string {
  const url = new URL(rawUrl);
  const host = safeSegment(url.hostname);

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map(safeSegment);

  const last = segments[segments.length - 1];
  const hasExtension = !!last && /\.[a-z0-9]{1,8}$/i.test(last);

  // A query string changes what the server returns, so two URLs that differ
  // only by query must not share a file. A short hash of the query keeps them
  // apart while staying deterministic.
  const queryTag = url.search
    ? `-${createHash("sha1").update(url.search).digest("hex").slice(0, 8)}`
    : "";

  if (!last || (isDocument && !hasExtension)) {
    // A directory style URL becomes index.html inside that directory, which is
    // what a browser opens when you point it at the folder.
    return [host, ...segments, `index${queryTag}.html`].join("/");
  }

  if (!hasExtension) {
    const ext = isDocument ? ".html" : "";
    segments[segments.length - 1] = `${last}${queryTag}${ext}`;
    return [host, ...segments].join("/");
  }

  if (queryTag) {
    const dot = last.lastIndexOf(".");
    segments[segments.length - 1] =
      `${last.slice(0, dot)}${queryTag}${last.slice(dot)}`;
  }

  return [host, ...segments].join("/");
}

/**
 * A relative link from one local file to another, which is what makes the
 * output work offline. Both inputs are paths produced by urlToLocalPath.
 */
export function relativeLink(fromPath: string, toPath: string): string {
  const from = fromPath.split("/").slice(0, -1);
  const to = toPath.split("/");

  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) {
    shared++;
  }

  const up = from.length - shared;
  const rel = [...Array(up).fill(".."), ...to.slice(shared)].join("/");
  return rel || to[to.length - 1];
}
