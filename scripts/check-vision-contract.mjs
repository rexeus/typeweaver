import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const vision = readFileSync(path.join(workspaceRoot, "VISION.md"), "utf8");
const requiredHeadings = [
  "# TypeWeaver vision",
  "## Target users and jobs",
  "## One contract, many projections",
  "## Product principles",
  "## Explicit non-goals",
  "## North-star workflow",
  "## Standards and runtime portability",
  "## Effect is optional",
  "## Measurable success signals",
];
const headings = new Set(
  vision
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("#"))
);
const missingHeadings = requiredHeadings.filter(
  heading => !headings.has(heading)
);

if (missingHeadings.length > 0) {
  process.stderr.write(
    `VISION.md is missing required headings:\n${missingHeadings.join("\n")}\n`
  );
  process.exit(1);
}

process.stdout.write(
  `VISION.md contract verified across ${requiredHeadings.length} required headings\n`
);
