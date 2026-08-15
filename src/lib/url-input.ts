/**
 * Deciding whether something is worth scanning, before we scan it.
 *
 * Typing "jjj" used to run a full job: the browser launched, tried to resolve a
 * hostname that cannot exist, and came back with net::ERR_NAME_NOT_RESOLVED.
 * That is thirty seconds and a raw Chromium string for a mistake we could have
 * caught instantly.
 */

/** A hostname needs a dot and a plausible suffix after it. */
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export interface UrlCheck {
  ok: boolean;
  /** What to show under the field. Empty while the person is still typing. */
  message?: string;
  /** The address to actually submit, with a scheme added if it was missing. */
  normalised?: string;
}

export function checkUrlInput(raw: string): UrlCheck {
  const value = raw.trim();
  if (!value) return { ok: false };

  if (/\s/.test(value)) {
    return { ok: false, message: "A web address cannot contain spaces." };
  }

  // Reject anything that is not the web early, with a reason.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return { ok: false, message: `Only web addresses work here, not ${scheme}.` };
  }

  const withScheme = scheme ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, message: "That does not look like a web address." };
  }

  const host = url.hostname.toLowerCase();

  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, message: "Addresses on your own network cannot be scanned." };
  }

  // A bare word like "jjj" parses as a URL but can never resolve, so catch it
  // here rather than letting a browser find out the slow way.
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!isIpv4 && !HOSTNAME.test(host)) {
    return {
      ok: false,
      message: host.includes(".")
        ? "That web address is not valid."
        : "Add a domain ending, like .com.",
    };
  }

  return { ok: true, normalised: url.toString() };
}

/**
 * Turns whatever went wrong into something a person can act on.
 *
 * The engine and the browser both produce technical strings. Showing
 * "net::ERR_NAME_NOT_RESOLVED" tells someone nothing about what to do next.
 */
export function humaniseScanError(raw: string): string {
  const e = raw.toLowerCase();

  if (e.includes("err_name_not_resolved") || e.includes("could not resolve")) {
    return "We could not find that site. Check the address for a typo.";
  }
  if (e.includes("err_connection_refused") || e.includes("econnrefused")) {
    return "That site refused the connection.";
  }
  if (e.includes("err_connection_timed_out") || e.includes("timeout") || e.includes("timed out")) {
    return "That site took too long to respond. It may be slow or blocking us.";
  }
  if (e.includes("err_cert") || e.includes("ssl") || e.includes("certificate")) {
    return "That site has a security certificate problem, so we did not load it.";
  }
  if (e.includes("private address") || e.includes("local addresses")) {
    return raw; // already written for a person
  }
  if (e.includes("403") || e.includes("forbidden")) {
    return "That site blocked us. Some sites refuse automated visitors.";
  }
  if (e.includes("404") || e.includes("not found")) {
    return "That page does not exist.";
  }
  if (e.includes("429") || e.includes("too many")) {
    return "That site is rate limiting us. Try again in a minute.";
  }
  if (/\b5\d\d\b/.test(e)) {
    return "That site returned a server error. It may be down.";
  }
  if (e.includes("err_")) {
    return "That page could not be loaded.";
  }

  return raw;
}
