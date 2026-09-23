import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { parse } from "semver";
import { createDoctorCheck } from "../reports/DoctorReport.js";
import { resolveWorkspaceEffect } from "./effectWorkspaceResolution.js";
import type { DoctorCheck } from "../reports/DoctorReport.js";
import type { WorkspaceEffectDeclaration } from "./effectWorkspaceResolution.js";

/**
 * The exact Effect runtime shared by the CLI programmatic API, generator,
 * first-party plugins, and adapter.
 */
export const SUPPORTED_EFFECT_PEER_RANGE = "4.0.0-rc.116";

/**
 * Alias retained for the doctor's public diagnostic wording. This is a
 * required native version, not isolated-CLI evidence.
 */
export const REQUIRED_EFFECT_VERSION = "4.0.0-rc.116";

const BUILT_IN_PLAIN_PLUGINS = new Set([
  "aws-cdk",
  "clients",
  "server",
  "types",
]);

const EFFECT_NATIVE_PLUGINS = new Set([
  "effect",
  "@rexeus/typeweaver-effect",
  "command",
  "@rexeus/typeweaver-command",
  "hono",
  "@rexeus/typeweaver-hono",
  "openapi",
  "@rexeus/typeweaver-openapi",
]);

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
export type WorkspaceEffectCompatibilityFacts = {
  readonly workspaceEffect: WorkspaceEffectDeclaration;
  readonly configuredPlugins: readonly PluginEntry[];
};

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

const nativeSurfaces = (
  classification: ConfiguredPluginClassification
): readonly string[] => [...classification.effect, ...classification.external];

const skipCheck = (): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "skip",
    message:
      "The project does not declare an Effect dependency or peer, and no Effect-native or custom plugin is configured, so workspace Effect compatibility is not applicable.",
  });

const passCheck = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "pass",
    message: `The project declares and resolves the exact native Effect ${version} required by the CLI programmatic API, generator plugins, first-party plugins, and adapter.`,
  });

const failUnresolvedCheck = (detail: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project declares Effect, but doctor cannot verify the declaration: ${detail}`,
    hint: "Install the declared Effect version or correct the package.json specifier.",
  });

const failNotDeclaredNativeCheck = (surfaces: readonly string[]): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project does not declare Effect, but these configured surfaces require a project-owned Effect ${SUPPORTED_EFFECT_PEER_RANGE} runtime: ${surfaces.join(", ")}. The TypeWeaver CLI's nested Effect runtime cannot satisfy generated plugin or adapter contracts.`,
    hint: `Declare effect ${SUPPORTED_EFFECT_PEER_RANGE} in the project, or select only built-in plain projections.`,
  });

const warnUnsupportedCheck = (version: string): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "warn",
    message: `The project resolves Effect ${version}, not the exact native TypeWeaver requirement ${REQUIRED_EFFECT_VERSION}. The binary CLI's own runtime is independent, but the programmatic API, generator plugins, first-party plugins, and adapter are not verified with this project runtime.`,
    hint: `Install effect ${REQUIRED_EFFECT_VERSION} before using an Effect-native TypeWeaver surface.`,
  });

const failEffect4Check = (
  version: string,
  surfaces: readonly string[]
): DoctorCheck =>
  createDoctorCheck({
    code: "TW-DOCTOR-011",
    name: "workspace Effect compatibility",
    outcome: "fail",
    message: `The project resolves Effect ${version}, but these configured surfaces require the exact native TypeWeaver runtime ${REQUIRED_EFFECT_VERSION}: ${surfaces.join(", ")}.`,
    hint: `Run this project on ${REQUIRED_EFFECT_VERSION}, or use built-in plain projections.`,
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
 * Classifies a verified, declared Effect resolution together with the
 * configured plugin surfaces.
 */
const classifyResolvedEffect = (
  version: string,
  surfaces: readonly string[]
): DoctorCheck => {
  if (parse(version) === null) {
    return failUnrecognizedCheck(version);
  }
  if (version === REQUIRED_EFFECT_VERSION) {
    return passCheck(version);
  }
  if (surfaces.length > 0) {
    return failEffect4Check(version, surfaces);
  }
  return warnUnsupportedCheck(version);
};

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
  const classification = classifyConfiguredPlugins(facts.configuredPlugins);
  const surfaces = nativeSurfaces(classification);
  if (workspaceEffect._tag === "NotDeclared") {
    return surfaces.length > 0
      ? failNotDeclaredNativeCheck(surfaces)
      : skipCheck();
  }
  if (workspaceEffect._tag === "Unresolved") {
    return failUnresolvedCheck(workspaceEffect.detail);
  }
  return classifyResolvedEffect(workspaceEffect.version, surfaces);
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
