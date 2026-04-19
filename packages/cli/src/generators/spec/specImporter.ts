import { pathToFileURL } from "node:url";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { InvalidSpecEntrypointError } from "./invalidSpecEntrypointError.js";
import { isSpecDefinition } from "./specGuards.js";

export async function importDefinition(
  bundledSpecFile: string
): Promise<SpecDefinition> {
  const moduleUrl = pathToFileURL(bundledSpecFile).toString();
  const specModule = (await import(moduleUrl)) as {
    readonly spec?: unknown;
    readonly default?: unknown;
  };
  const definition = specModule.spec ?? specModule.default ?? specModule;

  if (!isSpecDefinition(definition)) {
    throw new InvalidSpecEntrypointError(bundledSpecFile);
  }

  return definition;
}
