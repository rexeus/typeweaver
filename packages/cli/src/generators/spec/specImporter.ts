import { createHash } from "node:crypto";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { SpecDefinition } from "@rexeus/typeweaver-core";
import { InvalidSpecEntrypointError } from "./InvalidSpecEntrypointError.js";
import { isSpecDefinition } from "./specGuards.js";

export async function importDefinition(
  bundledSpecFile: string
): Promise<SpecDefinition> {
  const contentHash = createHash("sha256")
    .update(fs.readFileSync(bundledSpecFile))
    .digest("hex");
  const moduleUrl = pathToFileURL(bundledSpecFile);

  moduleUrl.searchParams.set("content", contentHash);

  const specModule = (await import(moduleUrl.toString())) as {
    readonly spec?: unknown;
    readonly default?: unknown;
  };
  const definition = specModule.spec ?? specModule.default ?? specModule;

  if (!isSpecDefinition(definition)) {
    throw new InvalidSpecEntrypointError(bundledSpecFile);
  }

  return definition;
}
