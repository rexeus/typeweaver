/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__test__/**/*.test.ts"],
    isolate: true,
    fileParallelism: false,
  },
  cacheDir: ".vitestcache",
});
