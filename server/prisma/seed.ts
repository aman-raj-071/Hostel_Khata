import { createDb } from "../src/db.js";
import { cleanupExpiredDemos } from "../src/demo.js";

const db = createDb();
try {
  await cleanupExpiredDemos(db);
  console.log(
    "No shared public seed. Try demo creates a private 24-hour group with 25 sample expenses per session. Existing real and legacy data is preserved.",
  );
} finally {
  await db.$disconnect();
}
