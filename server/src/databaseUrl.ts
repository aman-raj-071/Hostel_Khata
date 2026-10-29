import { resolve } from "node:path";
export function databaseUrl(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required. See server/.env.example.");
  return url.startsWith("file:") ? `file:${resolve(url.slice(5)).replaceAll("\\", "/")}` : url;
}
