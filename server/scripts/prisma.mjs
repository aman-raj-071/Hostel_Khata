import "dotenv/config";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

// Provide a default DATABASE_URL for build-time generation if not set
if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set, using build-time default for Prisma generation");
  process.env.DATABASE_URL = "postgresql://build:build@localhost:5432/build";
}

const sqlite = process.env.DATABASE_URL?.startsWith("file:");
if (sqlite)
  writeFileSync(
    "prisma/schema.sqlite.prisma",
    readFileSync("prisma/schema.prisma", "utf8").replace(
      'provider = "postgresql"',
      'provider = "sqlite"',
    ),
  );
const args = process.argv.slice(2);
if (sqlite && args[0] === "migrate" && args[1] === "deploy") {
  // Prisma's Windows schema engine needs an existing SQLite file on first setup.
  closeSync(openSync(resolve(process.env.DATABASE_URL.slice(5)), "a"));
  const localDb = new Database(resolve(process.env.DATABASE_URL.slice(5)));
  try {
    const old = localDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='members'")
      .get();
    const renamed = localDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='group_members'")
      .get();
    if (
      old &&
      !renamed &&
      readFileSync("prisma/schema.prisma", "utf8").includes('@@map("group_members")')
    )
      localDb.exec('ALTER TABLE "members" RENAME TO "group_members"');
  } finally {
    localDb.close();
  }
  args.splice(0, 2, "db", "push");
}
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
