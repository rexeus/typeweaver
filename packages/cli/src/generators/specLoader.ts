import fs from "node:fs";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { bundle } from "./spec/specBundler";
import { importDefinition } from "./spec/specImporter";

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

  const definition = await importDefinition(bundledSpecFile);
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
