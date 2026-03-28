import fs from "node:fs";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { SpecBundler } from "./spec/SpecBundler";
import { SpecImporter } from "./spec/SpecImporter";

export type SpecLoaderConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type LoadedSpec = {
  readonly definition: SpecDefinition;
  readonly normalizedSpec: NormalizedSpec;
};

export class SpecLoader {
  private readonly bundler: SpecBundler;

  private readonly importer: SpecImporter;

  public constructor(
    bundler: SpecBundler = new SpecBundler(),
    importer: SpecImporter = new SpecImporter()
  ) {
    this.bundler = bundler;
    this.importer = importer;
  }

  public async load(config: SpecLoaderConfig): Promise<LoadedSpec> {
    fs.mkdirSync(config.specOutputDir, { recursive: true });

    const bundledSpecFile = await this.bundler.bundle(config);
    this.writeSpecDeclarationFile(config.specOutputDir);

    const definition = await this.importer.importDefinition(bundledSpecFile);
    const normalizedSpec = normalizeSpec(definition);

    return {
      definition,
      normalizedSpec,
    };
  }

  private writeSpecDeclarationFile(specOutputDir: string): void {
    fs.writeFileSync(
      `${specOutputDir}/spec.d.ts`,
      [
        'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
        "declare const _default: SpecDefinition;",
        "export default _default;",
        "export declare const spec: SpecDefinition;",
        "",
      ].join("\n")
    );
  }
}
