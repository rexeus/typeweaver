import path from "node:path";
import process from "node:process";
import {
  collectEffectDiagnostics,
  effectDiagnostics,
  exemptedEffectDiagnostics,
  formatEffectDiagnostics,
  listExemptedEffectDiagnostics,
  summarizeExemptedEffectDiagnostics,
  workspaceRoot,
} from "./lib/effect-diagnostics.mjs";

const listExempted = process.argv.slice(2).includes("--list-exempted");
const results = collectEffectDiagnostics();
const diagnostics = effectDiagnostics(results);
const exempted = exemptedEffectDiagnostics(results);
for (const result of results) {
  const relativeProject = path.relative(workspaceRoot, result.project);
  process.stdout.write(
    `Effect tsgo diagnostics: ${relativeProject} (${result.output.summary.filesChecked} files)\n`
  );
}
// Exempted warnings never block the gate, but they stay visible: always as a
// count per category and rule, and one by one with `--list-exempted`.
process.stdout.write(
  `Effect tsgo exempted warnings (non-blocking): ${exempted.length}\n`
);
for (const line of summarizeExemptedEffectDiagnostics(exempted)) {
  process.stdout.write(`  ${line}\n`);
}
if (listExempted) {
  for (const line of listExemptedEffectDiagnostics(exempted)) {
    process.stdout.write(`  ${line}\n`);
  }
} else if (exempted.length > 0) {
  process.stdout.write(
    "  List each one with: pnpm effect:diagnostics --list-exempted\n"
  );
}
if (diagnostics.length > 0) {
  process.stderr.write(`${formatEffectDiagnostics(results)}\n`);
  throw new Error(
    `Effect tsgo Recommended gate found ${diagnostics.length} blocking diagnostics`
  );
}
process.stdout.write(
  `Effect tsgo Recommended diagnostics passed with no blocking diagnostics and ${exempted.length} exempted warnings\n`
);
