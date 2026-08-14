/** Submits a real job the way the web app will, then watches the row. */
import { db } from "../src/lib/db.js";
import { enqueueSiteJob } from "../src/queue/queue.js";

async function main() {
  const url = process.argv[2] ?? "https://example.com";
  const job = await db.job.create({
    data: { url, ip: "127.0.0.1", depth: 1, maxPages: 25 },
  });
  console.log(`  queued ${job.id}  ->  ${url}`);
  await enqueueSiteJob(job.id);

  let last = "";
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const j = await db.job.findUnique({ where: { id: job.id } });
    if (!j) break;
    const line = `${j.status.padEnd(9)} ${j.assetsDone} files  ${(j.bytes / 1024 / 1024).toFixed(1)}MB  ${j.stage ?? ""}`;
    if (line !== last) { console.log(`  ${line}`); last = line; }
    if (j.status === "complete" || j.status === "failed") {
      if (j.error) console.log(`  error: ${j.error}`);
      if (j.zipKey) console.log(`  zip:   ${j.zipKey} (${((j.zipBytes ?? 0) / 1024 / 1024).toFixed(1)}MB)`);
      if (j.expiresAt) console.log(`  link expires: ${j.expiresAt.toISOString()}`);
      break;
    }
  }
  await db.$disconnect();
}
main();
