import "dotenv/config";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["src/**/*.integration.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
