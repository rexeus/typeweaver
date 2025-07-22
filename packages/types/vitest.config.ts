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
    coverage: {
      enabled: false, // Enable via --coverage flag
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "__test__"],
      extension: [".ts"],
      include: [
        "../test-utils/src/test-project/output/todo/CreateTodoRequestValidator.ts",
      ],
    },
    poolOptions: {
      vmThreads: {
        singleThread: false,
        isolate: true,
        useAtomics: true,
      },
    },
    fileParallelism: true,
  },
  cacheDir: ".vitestcache",
});
