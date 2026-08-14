import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
  datasource: { url: env("DATABASE_URL") },
});
