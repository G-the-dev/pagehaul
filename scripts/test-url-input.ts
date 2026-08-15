import { checkUrlInput, humaniseScanError } from "../src/lib/url-input.js";

const cases: [string, boolean][] = [
  ["stripe.com", true],
  ["https://stripe.com/pricing", true],
  ["www.bbc.co.uk", true],
  ["jjj", false],
  ["hello world", false],
  ["localhost", false],
  ["file:///etc/passwd", false],
  ["ftp://a.com", false],
  ["...", false],
  ["a.b", false],
];

let pass = 0;
for (const [input, expect] of cases) {
  const r = checkUrlInput(input);
  const ok = r.ok === expect;
  if (ok) pass++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${r.ok ? "accept" : "reject"}  ${input.padEnd(28)} ${r.message ?? ""}`);
}
console.log(`\n  ${pass}/${cases.length} correct\n`);
console.log("  error translation:");
for (const e of ["net::ERR_NAME_NOT_RESOLVED at https://jjj/", "Navigation timeout of 30000ms exceeded", "The site returned 403."]) {
  console.log(`    ${e.slice(0, 40).padEnd(42)} -> ${humaniseScanError(e)}`);
}
process.exit(pass === cases.length ? 0 : 1);
