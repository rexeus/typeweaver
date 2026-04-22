import { resolve } from "node:path";
import { RUNTIMES_DIR } from "./helpers.js";
import { describeRuntimeContractSuite } from "./runtimeContract.js";

describeRuntimeContractSuite({
  title: "Bun runtime server",
  runtime: {
    name: "Bun",
    command: "bun",
    args: (script, port) => ["run", script, String(port)],
    script: resolve(RUNTIMES_DIR, "serve-bun.ts"),
    available: true,
  },
  skipIfUnavailable: true,
});
