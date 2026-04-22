import { resolve } from "node:path";
import { RUNTIMES_DIR } from "./helpers.js";
import { describeRuntimeContractSuite } from "./runtimeContract.js";

describeRuntimeContractSuite({
  title: "Node.js runtime server",
  runtime: {
    name: "Node.js",
    command: "tsx",
    args: (script, port) => [script, String(port)],
    script: resolve(RUNTIMES_DIR, "serve-node.ts"),
    available: true,
  },
});
