import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved the database location out of schema.prisma and into this file.
 * The schema describes shape only; where the data lives is decided here.
 *
 * The dotenv import matters: unlike the app, this config file does not read
 * .env on its own, so DATABASE_URL would be undefined without it.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  // A plain fallback rather than env(), which throws when the variable is
  // missing. The build machine has no database and does not need one: it only
  // generates the client types. The real URL is supplied at runtime.
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
