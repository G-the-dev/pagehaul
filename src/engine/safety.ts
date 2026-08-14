import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Everything that decides whether a URL is safe to fetch.
 *
 * The danger this guards against is SSRF: someone hands us a URL that looks
 * public but resolves to an address inside our own network, and we fetch it on
 * their behalf. The classic target is 169.254.169.254, the cloud metadata
 * endpoint, which on many hosts hands out credentials to anything that asks.
 *
 * A hostname check alone is not enough, because a public name can resolve to a
 * private address. So we resolve the name and check the address it lands on.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Only these two schemes. No file:, no data:, no ftp:. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns true when an IPv4 address is one we must never fetch.
 * Ranges are from RFC 1918 (private), RFC 3927 (link-local) and friends.
 */
function isBlockedIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** Same idea for IPv6, including addresses that wrap an IPv4 one. */
function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true; // unspecified, loopback
  if (s.startsWith("fe80")) return true; // link-local
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
  if (s.startsWith("ff")) return true; // multicast

  // ::ffff:169.254.169.254 style addresses embed IPv4, so check that too.
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (v4) return isBlockedIPv4(v4[1]);
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIPv4(ip);
  if (kind === 6) return isBlockedIPv6(ip);
  return true; // not an address we recognise, so refuse it
}

/**
 * Parses and normalises a URL, rejecting anything we will not fetch.
 * This is the cheap check: scheme, shape, and obviously local hostnames.
 */
export function parseTargetUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new UnsafeUrlError("No URL given.");

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${raw}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(
      `Only http and https are allowed. Got: ${url.protocol}`,
    );
  }

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new UnsafeUrlError(`Refusing to fetch a local address: ${host}`);
  }

  return url;
}

/**
 * The expensive check: resolve the hostname and inspect every address it
 * returns. Call this on the first URL and again after every redirect, because
 * a public URL can redirect to a private one.
 */
export async function assertSafeToFetch(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no DNS, but still needs checking.
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new UnsafeUrlError(`Refusing to fetch a private address: ${host}`);
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve hostname: ${host}`);
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError(`Hostname resolved to nothing: ${host}`);
  }

  // If any address is blocked we refuse the whole hostname. Being strict here
  // is cheap; being wrong is a security hole.
  for (const { address } of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeUrlError(
        `${host} resolves to a private address (${address}). Refusing.`,
      );
    }
  }
}

/** Convenience: parse and fully validate in one call. */
export async function validateTargetUrl(raw: string): Promise<URL> {
  const url = parseTargetUrl(raw);
  await assertSafeToFetch(url);
  return url;
}
