import "dotenv/config";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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
  args.splice(0, 2, "db", "push");
}
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
