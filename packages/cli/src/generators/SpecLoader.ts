import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { normalizeSpec } from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { build } from "rolldown";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isRequestDefinition = (value: unknown): boolean => {
  return value === undefined || isRecord(value);
};

const isResponseDefinition = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.description === "string" &&
    value.description.length > 0 &&
    typeof value.statusCode === "number"
  );
};

const isOperationDefinition = (value: unknown): boolean => {
  if (!isRecord(value) || !Array.isArray(value.responses)) {
    return false;
  }

  return (
    typeof value.operationId === "string" &&
    value.operationId.length > 0 &&
    typeof value.path === "string" &&
    value.path.length > 0 &&
    typeof value.summary === "string" &&
    value.summary.length > 0 &&
    Object.values(HttpMethod).includes(value.method as HttpMethod) &&
    isRequestDefinition(value.request) &&
    value.responses.every(response => isResponseDefinition(response))
  );
};

const isResourceDefinition = (value: unknown): boolean => {
  return (
    isRecord(value) &&
    Array.isArray(value.operations) &&
    value.operations.every(isOperationDefinition)
  );
};

export type SpecLoaderConfig = {
  readonly inputFile: string;
  readonly specOutputDir: string;
};

export type LoadedSpec = {
  readonly definition: SpecDefinition;
  readonly normalizedSpec: NormalizedSpec;
};

export class InvalidSpecEntrypointError extends Error {
  public constructor(specEntrypoint: string) {
    super(
      `Spec entrypoint '${specEntrypoint}' must export a SpecDefinition as its default export, named 'spec' export, or module namespace.`
    );
    this.name = "InvalidSpecEntrypointError";
  }
}

export class SpecLoader {
  public async load(config: SpecLoaderConfig): Promise<LoadedSpec> {
    fs.mkdirSync(config.specOutputDir, { recursive: true });

    const bundledSpecFile = await this.bundleSpecEntrypoint(config);
    this.writeSpecDeclarationFile(config.specOutputDir);

    const definition = await this.importSpecDefinition(bundledSpecFile);
    const normalizedSpec = normalizeSpec(definition);

    this.writeOperationShims(normalizedSpec, config.specOutputDir);

    return {
      definition,
      normalizedSpec,
    };
  }

  private async bundleSpecEntrypoint(
    config: SpecLoaderConfig
  ): Promise<string> {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "typeweaver-spec-loader-")
    );
    const wrapperFile = path.join(tempDir, "spec-entrypoint.ts");
    const normalizedInputFile = config.inputFile.replaceAll(path.sep, "/");

    fs.writeFileSync(
      wrapperFile,
      [
        `import * as specModule from ${JSON.stringify(normalizedInputFile)};`,
        "const resolvedSpec =",
        '  Reflect.get(specModule, "default") ??',
        '  Reflect.get(specModule, "spec") ??',
        "  specModule;",
        "",
        "export default resolvedSpec;",
        "export const spec = resolvedSpec;",
        "",
      ].join("\n")
    );

    try {
      await build({
        cwd: tempDir,
        input: wrapperFile,
        treeshake: true,
        external: (source: string) => {
          if (source.startsWith("node:")) {
            return true;
          }

          return !source.startsWith(".") && !path.isAbsolute(source);
        },
        output: {
          file: path.join(config.specOutputDir, "spec.js"),
          format: "esm",
        },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const bundledSpecFile = path.join(config.specOutputDir, "spec.js");

    if (!fs.existsSync(bundledSpecFile)) {
      throw new Error(
        `Failed to bundle spec entrypoint '${config.inputFile}' to '${bundledSpecFile}'.`
      );
    }

    return bundledSpecFile;
  }

  private writeSpecDeclarationFile(specOutputDir: string): void {
    fs.writeFileSync(
      path.join(specOutputDir, "spec.d.ts"),
      [
        'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
        "declare const _default: SpecDefinition;",
        "export default _default;",
        "export declare const spec: SpecDefinition;",
        "",
      ].join("\n")
    );
  }

  private async importSpecDefinition(
    bundledSpecFile: string
  ): Promise<SpecDefinition> {
    const moduleUrl = pathToFileURL(bundledSpecFile).toString();
    const specModule = (await import(moduleUrl)) as {
      readonly default?: unknown;
      readonly spec?: unknown;
    };
    const definition = specModule.default ?? specModule.spec ?? specModule;

    if (!this.isSpecDefinition(definition)) {
      throw new InvalidSpecEntrypointError(bundledSpecFile);
    }

    return definition;
  }

  private isSpecDefinition(value: unknown): value is SpecDefinition {
    if (!isRecord(value) || !isRecord(value.resources)) {
      return false;
    }

    return Object.values(value.resources).every(isResourceDefinition);
  }

  private writeOperationShims(
    normalizedSpec: NormalizedSpec,
    specOutputDir: string
  ): void {
    for (const resource of normalizedSpec.resources) {
      const resourceDir = path.join(specOutputDir, resource.name);
      fs.mkdirSync(resourceDir, { recursive: true });

      resource.operations.forEach((operation, index) => {
        fs.writeFileSync(
          path.join(resourceDir, `${operation.operationId}Definition.ts`),
          [
            'import spec from "../spec";',
            "",
            `export default spec.resources[${JSON.stringify(resource.name)}]!.operations[${index}]!;`,
            "",
          ].join("\n")
        );
      });
    }
  }
}
