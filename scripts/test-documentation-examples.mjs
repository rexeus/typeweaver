import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runDocumentationExampleCases } from "./lib/documentation-example-test-cases.mjs";

const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "typeweaver-documentation-examples-")
);
try {
  runDocumentationExampleCases(fixtureRoot);
} finally {
  rmSync(fixtureRoot, { recursive: true });
}

process.stdout.write(
  "Documentation example checker rejected invalid fixtures and manifests\n"
);
