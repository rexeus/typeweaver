import { resolve } from "node:path";
import { RUNTIMES_DIR, TEST_UTILS_ROOT } from "./helpers.js";
import { describeRuntimeContractSuite } from "./runtimeContract.js";

describeRuntimeContractSuite({
  title: "Deno runtime server",
  runtime: {
    name: "Deno",
    command: "deno",
    args: (script, port) => [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-env",
      "--sloppy-imports",
      `--config=${resolve(TEST_UTILS_ROOT, "deno.json")}`,
      script,
      String(port),
    ],
    script: resolve(RUNTIMES_DIR, "serve-deno.ts"),
    available: true,
  },
  skipIfUnavailable: true,
});
