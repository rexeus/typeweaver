import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parse, satisfies, validRange } from "semver";

export type WorkspaceEffectDeclaration =
  | { readonly _tag: "NotDeclared" }
  | {
      readonly _tag: "Resolved";
      readonly version: string;
      readonly declaredSpecifier: string;
    }
  | { readonly _tag: "Unresolved"; readonly detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const isMissingFile = (failure: unknown): boolean =>
  isRecord(failure) && Reflect.get(failure, "code") === "ENOENT";

const DECLARATION_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const readEffectVersion = (packageJsonPath: string): string | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || typeof parsed["version"] !== "string") {
    return undefined;
  }
  return parsed["version"];
};

const declaredSpecifier = (
  manifest: Record<string, unknown>
): string | undefined => {
  for (const section of DECLARATION_SECTIONS) {
    const dependencies = manifest[section];
    if (isRecord(dependencies) && typeof dependencies["effect"] === "string") {
      return dependencies["effect"];
    }
  }
  return undefined;
};

const resolveDeclaredEffect = (
  manifestPath: string,
  specifier: string
): WorkspaceEffectDeclaration => {
  const range = validRange(specifier);
  if (range === null) {
    return {
      _tag: "Unresolved",
      detail: `the project declares a non-semver Effect specifier '${specifier}' that cannot be verified`,
    };
  }
  let resolvedPath: string;
  try {
    resolvedPath = createRequire(manifestPath).resolve("effect/package.json");
  } catch (failure) {
    return { _tag: "Unresolved", detail: errorMessage(failure) };
  }
  const version = readEffectVersion(resolvedPath);
  if (version === undefined) {
    return {
      _tag: "Unresolved",
      detail: "the resolved Effect package does not declare a version",
    };
  }
  if (parse(version) === null) {
    return {
      _tag: "Unresolved",
      detail: `the resolved Effect version '${version}' is not valid semver`,
    };
  }
  if (!satisfies(version, range)) {
    return {
      _tag: "Unresolved",
      detail: `the project declares effect@${specifier} but the resolved version ${version} does not satisfy it`,
    };
  }
  return { _tag: "Resolved", version, declaredSpecifier: specifier };
};

export const resolveWorkspaceEffect = (
  currentWorkingDirectory: string
): WorkspaceEffectDeclaration => {
  const manifestPath = path.join(currentWorkingDirectory, "package.json");
  let source: string;
  try {
    source = readFileSync(manifestPath, "utf8");
  } catch (failure) {
    return isMissingFile(failure)
      ? { _tag: "NotDeclared" }
      : {
          _tag: "Unresolved",
          detail: `could not read ${manifestPath}: ${errorMessage(failure)}`,
        };
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(source);
  } catch (failure) {
    return {
      _tag: "Unresolved",
      detail: `${manifestPath} is not valid JSON: ${errorMessage(failure)}`,
    };
  }
  if (!isRecord(manifest)) return { _tag: "NotDeclared" };
  const specifier = declaredSpecifier(manifest);
  return specifier === undefined
    ? { _tag: "NotDeclared" }
    : resolveDeclaredEffect(manifestPath, specifier);
};
