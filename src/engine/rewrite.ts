import { relativeLink, urlToLocalPath } from "./paths.js";

/**
 * Turning absolute URLs into local paths.
 *
 * This is the step that decides whether the output is worth anything. A perfect
 * download whose HTML still points at https://example.com/logo.svg needs the
 * internet to open, which defeats the entire purpose.
 *
 * The work is finding every place a URL can hide. There are more than people
 * expect:
 *
 *   src="..."                     images, scripts, video, iframes
 *   href="..."                    stylesheets, icons, links between pages
 *   srcset="a.jpg 1x, b.jpg 2x"   several URLs and their descriptors
 *   style="background:url(...)"   inline styles on any element
 *   <style> ... url(...) </style>  embedded stylesheets
 *   @import "other.css"           one stylesheet pulling in another
 *   @font-face { src: url(...) }  fonts, which is why text renders wrong
 *
 * Miss any one and something breaks offline, usually the fonts.
 *
 * The rewrite is textual and narrow on purpose. We never reformat, minify or
 * otherwise touch a file beyond swapping a URL for a path.
 */

/** A URL we should leave exactly as it is. */
function isUntouchable(value: string): boolean {
  const v = value.trim();
  return (
    v === "" ||
    v.startsWith("#") ||
    v.startsWith("data:") ||
    v.startsWith("blob:") ||
    v.startsWith("mailto:") ||
    v.startsWith("tel:") ||
    v.startsWith("javascript:") ||
    v.startsWith("about:")
  );
}

export interface RewriteContext {
  /** Absolute URL of the file being rewritten, used to resolve relative refs. */
  baseUrl: string;
  /** Local path of the file being rewritten, used to build relative links. */
  fromPath: string;
  /** Every URL we actually saved, so we only rewrite what exists on disk. */
  savedUrls: Set<string>;
  /** Page URLs we captured, which become local html files. */
  savedPages?: Set<string>;
}

/**
 * Resolves one reference and returns the local path to use, or null when we
 * should leave it alone.
 *
 * Leaving a URL absolute is the right answer when we did not download it. A
 * broken relative path shows nothing at all, whereas an absolute URL at least
 * works for anyone who happens to be online.
 */
function localFor(value: string, ctx: RewriteContext): string | null {
  if (isUntouchable(value)) return null;

  let absolute: string;
  try {
    absolute = new URL(value, ctx.baseUrl).toString();
  } catch {
    return null;
  }

  if (!/^https?:/i.test(absolute)) return null;

  const isPage = ctx.savedPages?.has(absolute) ?? false;
  if (!isPage && !ctx.savedUrls.has(absolute)) return null;

  const target = urlToLocalPath(absolute, isPage);
  return relativeLink(ctx.fromPath, target);
}

/** Rewrites a srcset, which holds several URLs each with a descriptor. */
function rewriteSrcset(value: string, ctx: RewriteContext): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      // "image.jpg 2x" splits into the URL and everything after it.
      const spaceAt = trimmed.search(/\s/);
      const url = spaceAt === -1 ? trimmed : trimmed.slice(0, spaceAt);
      const descriptor = spaceAt === -1 ? "" : trimmed.slice(spaceAt);
      const local = localFor(url, ctx);
      return `${local ?? url}${descriptor}`;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Rewrites url(...) and @import inside CSS.
 *
 * Used both for stylesheet files and for the contents of a <style> block, which
 * is why it is separate. The base URL differs between the two: references in a
 * stylesheet resolve against that stylesheet's own address, not the page's.
 */
export function rewriteCss(css: string, ctx: RewriteContext): string {
  let out = css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (whole, quote: string, ref: string) => {
      const local = localFor(ref, ctx);
      return local ? `url(${quote}${local}${quote})` : whole;
    },
  );

  // @import can be written with or without url(). The url() form is already
  // handled above, so this catches the bare string form.
  out = out.replace(
    /@import\s+(['"])([^'"]+)\1/gi,
    (whole, quote: string, ref: string) => {
      const local = localFor(ref, ctx);
      return local ? `@import ${quote}${local}${quote}` : whole;
    },
  );

  return out;
}

/** Attributes that carry a single URL. */
const URL_ATTRIBUTES = [
  "src",
  "href",
  "poster",
  "data-src",
  "data-original",
  "action",
];

/**
 * Rewrites an HTML document.
 *
 * Deliberately a set of targeted regular expressions rather than a full parse
 * and re-serialise. Re-serialising rewrites the whole document, which risks
 * changing markup we were asked never to touch. This only edits the exact
 * characters inside the attributes it recognises.
 */
export function rewriteHtml(html: string, ctx: RewriteContext): string {
  let out = html;

  // A <base> tag would send every relative path back to the live site, so it
  // has to go once paths are local.
  out = out.replace(/<base\b[^>]*>/gi, "");

  for (const attr of URL_ATTRIBUTES) {
    const re = new RegExp(`(\\b${attr}\\s*=\\s*)(["'])(.*?)\\2`, "gi");
    out = out.replace(re, (whole, prefix: string, quote: string, value: string) => {
      const local = localFor(value, ctx);
      return local ? `${prefix}${quote}${local}${quote}` : whole;
    });
  }

  for (const attr of ["srcset", "data-srcset", "imagesrcset"]) {
    const re = new RegExp(`(\\b${attr}\\s*=\\s*)(["'])(.*?)\\2`, "gi");
    out = out.replace(re, (whole, prefix: string, quote: string, value: string) => {
      const rewritten = rewriteSrcset(value, ctx);
      return rewritten ? `${prefix}${quote}${rewritten}${quote}` : whole;
    });
  }

  // Inline styles can hold background images, which are otherwise missed
  // entirely because they never appear as an attribute of their own.
  out = out.replace(
    /(\bstyle\s*=\s*)(["'])(.*?)\2/gi,
    (whole, prefix: string, quote: string, value: string) => {
      if (!value.includes("url(")) return whole;
      return `${prefix}${quote}${rewriteCss(value, ctx)}${quote}`;
    },
  );

  // Embedded stylesheets resolve against the page, so the same context applies.
  out = out.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (whole, open: string, css: string, close: string) =>
      css.includes("url(") || css.includes("@import")
        ? `${open}${rewriteCss(css, ctx)}${close}`
        : whole,
  );

  return out;
}
