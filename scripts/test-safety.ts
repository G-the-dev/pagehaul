import { validateTargetUrl } from "../src/engine/safety.js";

const cases: [string, boolean][] = [
  ["https://example.com", true],
  ["http://169.254.169.254/latest/meta-data/", false],
  ["http://127.0.0.1:3000", false],
  ["http://192.168.1.1", false],
  ["http://10.0.0.5", false],
  ["http://172.16.4.2", false],
  ["http://localhost", false],
  ["file:///etc/passwd", false],
  ["http://[::1]/", false],
  ["http://metadata.google.internal/", false],
  ["http://0.0.0.0", false],
];

async function main() {
  let pass = 0;
  for (const [url, shouldAllow] of cases) {
    let allowed = true;
    try {
      await validateTargetUrl(url);
    } catch {
      allowed = false;
    }
    const ok = allowed === shouldAllow;
    if (ok) pass++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${allowed ? "allowed" : "blocked"}  ${url}`);
  }
  console.log(`\n  ${pass}/${cases.length} correct`);
  process.exit(pass === cases.length ? 0 : 1);
}

main();
