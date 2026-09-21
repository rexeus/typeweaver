import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileLines } from "./maintainability-probe-fixtures.mjs";

/** @param {{ configRoot: string, scriptsRoot: string, scriptsValidName: string, scriptsInvalidName: string, fixtureRoot: string }} roots @returns {void} */
export const writeClassifiedProbeFixtures = roots => {
  /** @type {readonly [string, string, string][]} */
  const classifiedRoots = [
    [roots.configRoot, "boundary-valid.test.ts", "boundary-invalid.test.ts"],
    [roots.scriptsRoot, roots.scriptsValidName, roots.scriptsInvalidName],
    [roots.fixtureRoot, "boundary-valid.tst.ts", "boundary-invalid.tst.ts"],
  ];
  for (const [directory, validName, invalidName] of classifiedRoots) {
    writeFileSync(path.join(directory, validName), `${fileLines(349)}\n`);
    writeFileSync(path.join(directory, invalidName), `${fileLines(350)}\n`);
  }
};
