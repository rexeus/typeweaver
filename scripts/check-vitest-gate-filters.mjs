import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { collectVitestGates } from "./lib/vitest-gate-discovery.mjs";
import { validateVitestGate } from "./lib/vitest-gate-filters.mjs";

// Enforces the filter contract documented in lib/vitest-gate-filters.mjs on
// every workspace script that selects Vitest suites by path, such as the
// Windows security, process, and documentation-workflow gates.
const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const gates = collectVitestGates(workspaceRoot);
const failures =
  gates.length === 0
    ? ["No workspace script passes file filters to Vitest"]
    : gates.flatMap(validateVitestGate);

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `Vitest gate filters select whole suites: ${gates.map(gate => gate.label).join(", ")}\n`
);
