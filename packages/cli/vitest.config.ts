/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    include: ["__test__/**/*.test.ts"],
    fileParallelism: true,
  },
  cacheDir: ".vitestcache",
});
