import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verifyDocumentationExamples } from "./lib/documentation-examples.mjs";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const requiredGroupIds = [
  "root-quickstart",
  "core-response-derivation",
  "generation-cli-config",
  "minimal-plugin",
  "scoped-service-plugin",
  "plugin-test-kit",
  "generated-client",
  "generated-command",
  "hono-handler",
  "fetch-server-handler",
  "openapi-options",
];
const result = verifyDocumentationExamples({
  workspaceRoot,
  manifestPath: "config/documentation-examples.json",
  requiredGroupIds,
});

if (result.failures.length > 0) {
  process.stderr.write(`${result.failures.join("\n")}\n`);
  process.exit(1);
}

for (const group of result.groups) {
  process.stdout.write(
    `Documentation example verified: ${group.id} (${group.fixtures.join(", ")})\n`
  );
}
