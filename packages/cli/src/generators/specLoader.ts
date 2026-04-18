import fs from "node:fs";
import path from "node:path";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { bundle } from "./spec/specBundler.js";
import { createSpecDependencyResolutionBridge } from "./spec/specDependencyResolution.js";
import { importDefinition } from "./spec/specImporter.js";
export {
  ensureSpecDependencyResolution,
  findClosestNodeModules,
} from "./spec/specDependencyResolution.js";

export type SpecLoaderConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type LoadedSpec = {
  readonly definition: SpecDefinition;
  readonly normalizedSpec: NormalizedSpec;
};

export async function loadSpec(config: SpecLoaderConfig): Promise<LoadedSpec> {
  fs.mkdirSync(config.specOutputDir, { recursive: true });

  const bundledSpecFile = await bundle(config);
  writeSpecDeclarationFile(config.specOutputDir);

  const cleanupDependencyResolutionBridge =
    createSpecDependencyResolutionBridge({
      specExecutionDir: path.dirname(config.specOutputDir),
      inputFile: config.inputFile,
    });
  const definition = await importDefinition(bundledSpecFile).finally(() => {
    cleanupDependencyResolutionBridge();
  });
  const normalizedSpec = normalizeSpec(definition);

  return {
    definition,
    normalizedSpec,
  };
}

function writeSpecDeclarationFile(specOutputDir: string): void {
  fs.writeFileSync(
    `${specOutputDir}/spec.d.ts`,
    [
      'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
      "export declare const spec: SpecDefinition;",
      "",
    ].join("\n")
  );
}
