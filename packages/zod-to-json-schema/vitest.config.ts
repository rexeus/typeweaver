/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    include: ["__test__/unit/**/*.test.ts"],
    isolate: true,
    fileParallelism: true,
  },
  cacheDir: ".vitestcache",
});
