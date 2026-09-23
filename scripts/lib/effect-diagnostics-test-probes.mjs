import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  runEffectProject,
  workspaceRoot as repositoryRoot,
} from "./effect-diagnostics-projects.mjs";

/** @typedef {Record<string, "error" | "warning">} SeverityMap */

export const cleanSource = `import { Effect } from "effect";

export const clean = Effect.succeed(1);
`;
export const knownErrorSource = `import { Effect } from "effect";

export const implicitAny = Effect.fn("probe.implicitAny")(value =>
  Effect.succeed(value)
);
`;
export const warningSource = `import { Effect } from "effect";

export const lazy = () => Effect.succeed(1);
`;
export const acceptedSource = `import { Effect } from "effect";

export const accepted = Effect.fn("probe.accepted")(
  // @effect-diagnostics-next-line effectFnImplicitAny:off
  value => Effect.succeed(value)
);
`;
export const staleSource = `import { Effect } from "effect";

// @effect-diagnostics-next-line asyncFunction:off
export const clean = Effect.succeed(1);
`;

/** @param {string} directory @param {string} source @param {string | undefined} boundarySource @returns {string} */
export const writeProbeProject = (directory, source, boundarySource) => {
  writeFileSync(
    path.join(directory, "tsconfig.json"),
    JSON.stringify(
      {
        extends: path.join(repositoryRoot, "packages/tsconfig/node.json"),
        compilerOptions: { noEmit: true, rootDir: "." },
        include:
          boundarySource === undefined
            ? ["probe.ts"]
            : ["probe.ts", "boundary.ts"],
      },
      null,
      2
    )
  );
  writeFileSync(path.join(directory, "probe.ts"), source);
  if (boundarySource !== undefined)
    writeFileSync(path.join(directory, "boundary.ts"), boundarySource);
  return path.join(directory, "tsconfig.json");
};

/** @param {SeverityMap} severityMap @returns {{ fixtureRoot: string, runProbe: (source: string) => import("./effect-diagnostics-projects.mjs").EffectProjectResult, runScopeProbe: (source: string) => import("./effect-diagnostics-projects.mjs").EffectProjectResult, runWithSeverity: (source: string, map: SeverityMap) => import("./effect-diagnostics-projects.mjs").EffectProjectResult, cleanup: () => void }} */
export const createProbeRunner = severityMap => {
  const fixtureRoot = mkdtempSync(
    path.join(repositoryRoot, "packages/cli", ".effect-tsgo-")
  );
  /** @param {string} source @returns {import("./effect-diagnostics-projects.mjs").EffectProjectResult} */
  const runProbe = source =>
    runEffectProject(
      writeProbeProject(fixtureRoot, source, undefined),
      severityMap
    );
  /** @param {string} source @returns {import("./effect-diagnostics-projects.mjs").EffectProjectResult} */
  const runScopeProbe = source =>
    runEffectProject(
      writeProbeProject(
        fixtureRoot,
        source,
        "export async function boundary() {\n  return 1;\n}\n"
      ),
      severityMap
    );
  /** @param {string} source @param {SeverityMap} map @returns {import("./effect-diagnostics-projects.mjs").EffectProjectResult} */
  const runWithSeverity = (source, map) =>
    runEffectProject(writeProbeProject(fixtureRoot, source, undefined), map);
  return {
    fixtureRoot,
    runProbe,
    runScopeProbe,
    runWithSeverity,
    cleanup: () => rmSync(fixtureRoot, { recursive: true, force: true }),
  };
};
