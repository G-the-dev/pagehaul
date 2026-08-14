import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * One Prisma client, shared.
 *
 * Prisma 7 no longer opens the database itself. You hand it an adapter that
 * owns the connection, which is why the SQLite driver appears here rather than
 * being implied by the schema.
 *
 * The global cache matters in development: Next.js reloads modules on every
 * edit, and without it each reload would open another connection until they
 * ran out.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
