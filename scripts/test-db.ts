/** Proves the database layer works without needing Redis or Docker. */
import { db } from "../src/lib/db.js";

async function main() {
  const job = await db.job.create({
    data: { url: "https://example.com", ip: "127.0.0.1", depth: 1, maxPages: 25 },
  });
  console.log(`  created   ${job.id}  status=${job.status}`);

  await db.job.update({
    where: { id: job.id },
    data: { status: "running", stage: "Opening the page", pagesFound: 1 },
  });
  const running = await db.job.findUnique({ where: { id: job.id } });
  console.log(`  updated   status=${running?.status}  stage="${running?.stage}"`);

  const recent = await db.job.count({
    where: { ip: "127.0.0.1", createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  console.log(`  ratelimit query works: ${recent} job(s) from this IP in the last hour`);

  await db.job.delete({ where: { id: job.id } });
  console.log(`  cleaned up`);
  await db.$disconnect();
}
main();
