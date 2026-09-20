import path from "node:path";
import process from "node:process";
import {
  collectEffectDiagnostics,
  effectDiagnostics,
  formatEffectDiagnostics,
  workspaceRoot,
} from "./lib/effect-diagnostics.mjs";

const results = collectEffectDiagnostics();
const diagnostics = effectDiagnostics(results);
for (const result of results) {
  const relativeProject = path.relative(workspaceRoot, result.project);
  process.stdout.write(
    `Effect tsgo diagnostics: ${relativeProject} (${result.output.summary.filesChecked} files)\n`
  );
}
if (diagnostics.length > 0) {
  process.stderr.write(`${formatEffectDiagnostics(results)}\n`);
  throw new Error(
    `Effect tsgo Recommended gate found ${diagnostics.length} diagnostics`
  );
}
process.stdout.write(
  "Effect tsgo Recommended diagnostics passed with no diagnostics\n"
);
