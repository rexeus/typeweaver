/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    include: [
      "__test__/unit/**/*.test.ts",
      "__test__/integration/**/*.test.ts",
    ],
    isolate: true,
    fileParallelism: false,
  },
  cacheDir: ".vitestcache",
});
