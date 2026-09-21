import { workspaceRoot } from "./lib/lint-policy-contract.mjs";
import { ruleCases } from "./lib/maintainability-fixtures.mjs";
import {
  assertNoEslintRuntime,
  assertRootConfiguration,
} from "./lib/maintainability-policy.mjs";
import { runMaintainabilityFixtures } from "./lib/maintainability-test-runner.mjs";

assertRootConfiguration();
assertNoEslintRuntime();
runMaintainabilityFixtures(workspaceRoot);
process.stdout.write(
  `Verified ${ruleCases.length} maintainability rules through pnpm lint without ESLint\n`
);
