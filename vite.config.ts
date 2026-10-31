// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const apiOrigin = process.env["API_ORIGIN"];
const isAmplify = process.env["AWS_APP_ID"];

export default defineConfig({
  vite: {
    server: {
      host: "127.0.0.1",
      port: 8080,
      strictPort: true,
      proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
    },
  },
  nitro: {
    preset: isAmplify ? "aws-amplify" : "node-server",
    ...(apiOrigin ? { routeRules: { "/api/**": { proxy: `${apiOrigin}/api/**` } } } : {}),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
