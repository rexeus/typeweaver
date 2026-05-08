import { spawnSync } from "node:child_process";

const generatedFixturePath = "packages/test-utils/src/test-project/output";

const result = spawnSync(
  "git",
  ["status", "--porcelain", "--", generatedFixturePath],
  {
    encoding: "utf8",
  }
);

if (result.error !== undefined) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const status = result.stdout;

if (status.trim().length === 0) {
  process.exit(0);
}

process.stderr.write(
  `Generated fixture output is out of date under ${generatedFixturePath}.\n` +
    "Run `pnpm run test:gen` and commit the generated fixture updates.\n\n" +
    status
);

process.exit(1);
