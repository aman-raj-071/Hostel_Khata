import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/databaseUrl.js";

export default defineConfig({
  schema: process.env.DATABASE_URL?.startsWith("file:")
    ? "prisma/schema.sqlite.prisma"
    : "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: databaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL) },
});
