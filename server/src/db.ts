import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { databaseUrl } from "./databaseUrl.js";

export function createDb(url = process.env.DATABASE_URL) {
  const connectionString = databaseUrl(url);
  return new PrismaClient({
    adapter: connectionString.startsWith("file:")
      ? new PrismaBetterSqlite3({ url: connectionString })
      : new PrismaPg({ connectionString }),
  });
}
