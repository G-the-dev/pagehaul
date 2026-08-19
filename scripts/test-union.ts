/** Proves the monotonic union: a worse rescan still ends with everything. */
import { mergeScans } from "../src/lib/merge";
import type { ScanResult, Asset } from "../src/lib/types";

const mk = (urls: string[]): ScanResult => ({
  target: "https://x.com",
  pages: [],
  ms: 1,
  notes: [],
  assets: urls.map(
    (u): Asset => ({
      id: u, url: u, kind: "image", format: "JPG", name: u,
      displayName: "", origin: "first-party", fromPage: "x",
    }),
  ),
});

const first = mk(["a.jpg", "b.jpg", "c.jpg"]);
const worseRescan = mk(["a.jpg", "d.jpg"]);
const union = mergeScans(worseRescan, first);
const urls = union.assets.map((a) => a.url).sort();
console.log("union:", urls.join(","));
console.log(
  urls.length === 4 && ["a.jpg", "b.jpg", "c.jpg", "d.jpg"].every((u) => urls.includes(u))
    ? "PASS  a worse rescan still ends with everything ever seen"
    : "FAIL",
);
