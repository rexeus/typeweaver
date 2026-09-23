/// <reference types="vitest" />
import { configDefaults, defineConfig } from "vitest/config";
import { PROCESS_TEST_TIMEOUT_MS } from "./__test__/helpers/builtCli.js";

/** Suites that spawn the built CLI, named `*.process` by convention. */
const processTests = [
  "__test__/**/*.process.test.ts",
  "__test__/**/*.process/**/*.test.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [],
    fileParallelism: true,
    projects: [
      {
        extends: true,
        test: {
          name: "standard",
          include: ["__test__/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...processTests],
        },
      },
      {
        extends: true,
        test: {
          name: "process",
          include: processTests,
          testTimeout: PROCESS_TEST_TIMEOUT_MS,
        },
      },
    ],
  },
  cacheDir: ".vitestcache",
});
