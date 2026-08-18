import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Opt-in config for live.smoke.ts — real API calls, real money. Never part of
// the default suite.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.smoke.ts", "src/**/*.audit.ts"],
    testTimeout: 120_000,
    pool: "forks",
  },
});
