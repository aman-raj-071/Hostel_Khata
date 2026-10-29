import { createDb } from "./db.js";
import { createApp } from "./app.js";

const db = createDb();
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
const server = createApp(db).listen(port, "0.0.0.0", () =>
  console.log(`Hostel Khata API listening on http://localhost:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
