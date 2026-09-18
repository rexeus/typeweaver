import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { parse, satisfies, validRange } from "semver";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";

/**
 * The Effect peer contract every Effect-native TypeWeaver surface publishes.
 * Effect 4 workspaces are handled only by running the binary CLI in isolation,
 * never by widening this range.
 */
export const SUPPORTED_EFFECT_PEER_RANGE = ">=3.22.0 <4";

/**
 * The single Effect 4 release candidate exercised by Phase A packed evidence.
 * It is an exact evidence pin, not a support range: every other Effect 4
 * version is unverified.
 */
export const PHASE_A_EFFECT_VERSION = "4.0.0-rc.115";

const BUILT_IN_PLAIN_PLUGINS = new Set([
  "aws-cdk",
  "clients",
  "command",
  "hono",
  "openapi",
  "server",
  "types",
]);

const EFFECT_NATIVE_PLUGINS = new Set(["effect", "@rexeus/typeweaver-effect"]);

const DECLARATION_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export type ConfiguredPluginClassification = {
  readonly plain: readonly string[];
  readonly effect: readonly string[];
  readonly external: readonly string[];
};

type PluginEntry = string | readonly [string, unknown];

/**
 * A project's Effect declaration is resolved only from the project boundary
 * at `currentWorkingDirectory`. A parent or the CLI's own tree never provides
 * a pass: it is used only when the resolved version satisfies the project's
 * own declared specifier. `Unresolved` is deliberately distinct from
 * `NotDeclared`, because a project that declares Effect but cannot verify it
 * is a truthful failure.
 */
export type WorkspaceEffectDeclaration =
  | { readonly _tag: "NotDeclared" }
  | {
      readonly _tag: "Resolved";
      readonly version: string;
      readonly declaredSpecifier: string;
    }
  | { readonly _tag: "Unresolved"; readonly detail: string };

export type WorkspaceEffectCompatibilityFacts = {
  readonly workspaceEffect: WorkspaceEffectDeclaration;
  readonly configuredPlugins: readonly PluginEntry[];
};

type ParsedVersion = {
  readonly major: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

const isMissingFile = (failure: unknown): boolean =>
  isRecord(failure) && Reflect.get(failure, "code") === "ENOENT";

const pluginSpecifier = (entry: PluginEntry): string =>
  typeof entry === "string" ? entry : entry[0];

const builtInPluginName = (specifier: string): string =>
  specifier.startsWith("@rexeus/typeweaver-")
    ? specifier.slice("@rexeus/typeweaver-".length)
    : specifier;

const pluginKind = (
  specifier: string
): keyof ConfiguredPluginClassification => {
  if (EFFECT_NATIVE_PLUGINS.has(specifier)) {
    return "effect";
  }
  return BUILT_IN_PLAIN_PLUGINS.has(builtInPluginName(specifier))
    ? "plain"
    : "external";
};

export const classifyConfiguredPlugins = (
  plugins: readonly PluginEntry[]
): ConfiguredPluginClassification => {
  const classification: Record<keyof ConfiguredPluginClassification, string[]> =
    { plain: [], effect: [], external: [] };
  for (const entry of plugins) {
    const specifier = pluginSpecifier(entry);
    classification[pluginKind(specifier)].push(specifier);
  }
  return classification;
};

const parseVersion = (version: string): ParsedVersion | undefined => {
  const parsed = parse(version);
  return parsed === null ? undefined : { major: parsed.major };
};

/**
 * Standard semver semantics: only a stable release inside `>=3.22.0 <4`
 * passes. Prereleases such as `3.22.0-rc.1` never satisfy a range that does
 * not itself name a prerelease.
 */
const isSupportedStableEffect3 = (version: string): boolean => {
  const parsed = parse(version);
  return (
    parsed !== null &&
    parsed.prerelease.length === 0 &&
    satisfies(parsed, SUPPORTED_EFFECT_PEER_RANGE)
  );
};

const nativeSurfaces = (
  classification: ConfiguredPluginClassification
): readonly string[] => [...classification.effect, ...classification.external];

const plainSummary = (
  classification: ConfiguredPluginClassification
): string =>
  classification.plain.length > 0
    ? classification.plain.join(", ")
    : "types, clients, server, hono, command, openapi, aws-cdk";

const skipCheck = (): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "skip",
    message:
      "The project does not declare an Effect dependency or peer, so workspace Effect compatibility is not applicable.",
  });

const passCheck = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "pass",
    message: `The project declares and resolves the stable Effect ${version}, which satisfies the supported ${SUPPORTED_EFFECT_PEER_RANGE} range for Effect-native plugins, the programmatic API, and the adapter.`,
  });

const failUnresolvedCheck = (detail: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project declares Effect, but doctor cannot verify the declaration: ${detail}`,
    hint: "Install the declared Effect version or correct the package.json specifier.",
  });

const warnTestedEffect4Check = (
  version: string,
  classification: ConfiguredPluginClassification
): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "warn",
    message: `The project resolves Effect ${version}, the exact release candidate exercised by Phase A packed evidence (pnpm, strict peers). The binary CLI can run as an isolated child process and generate Effect-independent output from built-in plain projections (${plainSummary(classification)}) only when the config module and spec entrypoint are Effect-neutral; doctor cannot verify that. Other Effect 4 versions are unverified, and direct imports of @rexeus/typeweaver-gen, @rexeus/typeweaver-effect, first-party Effect plugins, and the CLI programmatic API remain Effect ${SUPPORTED_EFFECT_PEER_RANGE} only.`,
    hint: "Keep Effect-native authoring and adapter use in a workspace that resolves Effect 3, and keep the config and spec Effect-neutral.",
  });

const warnUnverifiedEffect4Check = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "warn",
    message: `The project resolves Effect ${version}, which is UNVERIFIED: Phase A evidence covers only ${PHASE_A_EFFECT_VERSION}. TypeWeaver does not claim that the binary CLI can generate output or run in isolation for this version, and Effect-native surfaces remain Effect ${SUPPORTED_EFFECT_PEER_RANGE} only.`,
    hint: `Use Effect ${PHASE_A_EFFECT_VERSION} only for the exact Phase A evidence, or migrate to ${SUPPORTED_EFFECT_PEER_RANGE} for Effect-native surfaces.`,
  });

const failEffect4Check = (
  version: string,
  surfaces: readonly string[]
): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project resolves Effect ${version}, but these configured surfaces are Effect-native and supported only on ${SUPPORTED_EFFECT_PEER_RANGE}: ${surfaces.join(", ")}. The isolated CLI child process cannot bridge Effect values into the plugin or adapter ABI.`,
    hint: `Run this project on ${SUPPORTED_EFFECT_PEER_RANGE}, or use built-in plain projections without a custom plugin.`,
  });

const warnUnsupportedCheck = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "warn",
    message: `The project resolves Effect ${version}, outside the supported ${SUPPORTED_EFFECT_PEER_RANGE} range. TypeWeaver does not verify CLI generation or Effect-native surfaces for this version, so it makes no claim that either works here.`,
    hint: `Migrate the project to Effect ${SUPPORTED_EFFECT_PEER_RANGE} before relying on any TypeWeaver surface.`,
  });

const failUnsupportedCheck = (
  version: string,
  surfaces: readonly string[]
): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project resolves Effect ${version}, outside the supported ${SUPPORTED_EFFECT_PEER_RANGE} range, and these configured surfaces are Effect-native: ${surfaces.join(", ")}.`,
    hint: `Migrate the project to Effect ${SUPPORTED_EFFECT_PEER_RANGE} before using Effect-native plugins or the adapter.`,
  });

const failNewerMajorCheck = (
  version: string,
  surfaces: readonly string[]
): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project resolves Effect ${version}, a newer major than the supported ${SUPPORTED_EFFECT_PEER_RANGE} range, so no TypeWeaver surface is supported.${surfaces.length > 0 ? ` Configured Effect-native surfaces: ${surfaces.join(", ")}.` : ""}`,
    hint: `Use a workspace that resolves Effect ${SUPPORTED_EFFECT_PEER_RANGE}.`,
  });

const failUnrecognizedCheck = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project declares an unrecognized Effect version '${version}', so workspace compatibility cannot be established.`,
    hint: `Install Effect ${SUPPORTED_EFFECT_PEER_RANGE} or use built-in plain projections.`,
  });

/**
 * Pure classification of a project-owned, declaration-verified Effect
 * resolution and configured plugin specifiers. It never resolves modules or
 * inspects the CLI's own runtime, so callers control every fact in the
 * decision.
 */
export const classifyWorkspaceEffectCompatibility = (
  facts: WorkspaceEffectCompatibilityFacts
): DoctorCheck => {
  const { workspaceEffect } = facts;
  if (workspaceEffect._tag === "NotDeclared") {
    return skipCheck();
  }
  if (workspaceEffect._tag === "Unresolved") {
    return failUnresolvedCheck(workspaceEffect.detail);
  }
  const classification = classifyConfiguredPlugins(facts.configuredPlugins);
  const surfaces = nativeSurfaces(classification);
  const { version } = workspaceEffect;
  const parsed = parseVersion(version);
  if (parsed === undefined) {
    return failUnrecognizedCheck(version);
  }
  if (isSupportedStableEffect3(version)) {
    return passCheck(version);
  }
  if (parsed.major > 4) {
    return failNewerMajorCheck(version, surfaces);
  }
  if (surfaces.length > 0) {
    return parsed.major === 4
      ? failEffect4Check(version, surfaces)
      : failUnsupportedCheck(version, surfaces);
  }
  if (parsed.major !== 4) {
    return warnUnsupportedCheck(version);
  }
  return version === PHASE_A_EFFECT_VERSION
    ? warnTestedEffect4Check(version, classification)
    : warnUnverifiedEffect4Check(version);
};

const readEffectVersion = (packageJsonPath: string): string | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  } catch {
    return undefined;
  }
  if (!isRecord(parsed) || typeof parsed.version !== "string") {
    return undefined;
  }
  return parsed.version;
};

const declaredSpecifier = (
  manifest: Record<string, unknown>
): string | undefined => {
  for (const section of DECLARATION_SECTIONS) {
    const dependencies = manifest[section];
    if (isRecord(dependencies) && typeof dependencies.effect === "string") {
      return dependencies.effect;
    }
  }
  return undefined;
};

/**
 * Resolves the project's declared Effect and requires the resolved version to
 * satisfy the declaration under standard semver. A hoisted parent copy is
 * accepted only when it satisfies the declaration; otherwise the result is
 * `Unresolved` and the doctor fails rather than passing on the parent.
 */
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

/**
 * Resolves the Effect declaration owned by the project at
 * `currentWorkingDirectory`, never a parent tree or the CLI's bundled runtime.
 * A project boundary without an Effect declaration is `NotDeclared`.
 */
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
  if (!isRecord(manifest)) {
    return { _tag: "NotDeclared" };
  }
  const specifier = declaredSpecifier(manifest);
  return specifier === undefined
    ? { _tag: "NotDeclared" }
    : resolveDeclaredEffect(manifestPath, specifier);
};

export const checkWorkspaceEffectCompatibility = (
  config: Partial<TypeweaverConfig>,
  currentWorkingDirectory: string
): Effect.Effect<DoctorCheck> =>
  Effect.sync(() =>
    classifyWorkspaceEffectCompatibility({
      workspaceEffect: resolveWorkspaceEffect(currentWorkingDirectory),
      configuredPlugins: config.plugins ?? [],
    })
  );
