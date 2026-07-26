import { PluginDependencyError } from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { OutputCleanError } from "../src/errors/OutputCleanError.js";
import { UnsafeCleanTargetError } from "../src/errors/UnsafeCleanTargetError.js";
import { Generator } from "../src/services/Generator.js";
// @ts-expect-error GenerationError was an incomplete duplicate; GenerateFailure is canonical.
import type { GenerationError } from "../src/errors/index.js";
import type { GenerateFailure } from "../src/services/generatorTypes.js";

type Extends<Actual, Expected> = [Actual] extends [Expected] ? true : false;
type Assert<Condition extends true> = Condition;
type ActualGenerateFailure = Effect.Effect.Error<
  ReturnType<typeof Generator.generate>
>;

export type ActualFailureIsDeclared = Assert<
  Extends<ActualGenerateFailure, GenerateFailure>
>;
export type DeclaredFailureIsActual = Assert<
  Extends<GenerateFailure, ActualGenerateFailure>
>;
export type GenerateFailureIncludesOutputClean = Assert<
  Extends<OutputCleanError, GenerateFailure>
>;

new PluginDependencyError({
  pluginName: "clients",
  issue: {
    kind: "missing-dependency",
    dependencyName: "types",
  },
});
new PluginDependencyError({
  pluginName: "clients",
  issue: {
    kind: "dependency-cycle",
    path: ["clients", "types", "clients"],
  },
});

new PluginDependencyError({
  pluginName: "clients",
  // @ts-expect-error missing-dependency requires dependencyName.
  issue: { kind: "missing-dependency" },
});
new PluginDependencyError({
  pluginName: "clients",
  // @ts-expect-error dependency-cycle requires path.
  issue: { kind: "dependency-cycle" },
});
new PluginDependencyError({
  pluginName: "clients",
  issue: {
    kind: "missing-dependency",
    dependencyName: "types",
    // @ts-expect-error missing-dependency cannot also carry a path.
    path: ["clients", "types", "clients"],
  },
});
new PluginDependencyError({
  pluginName: "clients",
  issue: {
    kind: "dependency-cycle",
    path: ["clients", "types", "clients"],
    // @ts-expect-error dependency-cycle cannot also carry a dependencyName.
    dependencyName: "types",
  },
});

new UnsafeCleanTargetError({
  outputDir: " ",
  details: { reason: "empty-path" },
});
new UnsafeCleanTargetError({
  outputDir: "/",
  details: {
    reason: "filesystem-root",
    resolvedOutputDir: "/",
    currentWorkingDirectory: "/workspace",
    filesystemRoot: "/",
  },
});
new UnsafeCleanTargetError({
  outputDir: ".",
  details: {
    reason: "current-working-directory",
    resolvedOutputDir: "/workspace",
    currentWorkingDirectory: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace",
  details: {
    reason: "workspace-root",
    resolvedOutputDir: "/workspace",
    currentWorkingDirectory: "/workspace/packages/example",
    protectedWorkspaceRoot: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/packages",
  details: {
    reason: "ancestor-of-current-working-directory",
    resolvedOutputDir: "/workspace/packages",
    currentWorkingDirectory: "/workspace/packages/example",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/generated",
  details: {
    reason: "symbolic-link",
    resolvedOutputDir: "/workspace/generated",
    canonicalOutputDir: "/external/generated",
    currentWorkingDirectory: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/other-workspace",
  details: {
    reason: "target-carries-workspace-marker",
    resolvedOutputDir: "/other-workspace",
    currentWorkingDirectory: "/workspace",
    protectedWorkspaceRoot: "/other-workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/spec",
  details: {
    reason: "contains-input-file",
    resolvedOutputDir: "/workspace/spec",
    currentWorkingDirectory: "/workspace",
    inputFile: "/workspace/spec/index.ts",
  },
});

new UnsafeCleanTargetError({
  outputDir: " ",
  // @ts-expect-error empty-path cannot carry filesystem-root details.
  details: { reason: "empty-path", filesystemRoot: "/" },
});
new UnsafeCleanTargetError({
  outputDir: "/",
  // @ts-expect-error filesystem-root requires filesystemRoot.
  details: {
    reason: "filesystem-root",
    resolvedOutputDir: "/",
    currentWorkingDirectory: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: ".",
  // @ts-expect-error current-working-directory requires currentWorkingDirectory.
  details: {
    reason: "current-working-directory",
    resolvedOutputDir: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace",
  // @ts-expect-error workspace-root requires protectedWorkspaceRoot.
  details: {
    reason: "workspace-root",
    resolvedOutputDir: "/workspace",
    currentWorkingDirectory: "/workspace/packages/example",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/packages",
  // @ts-expect-error ancestor-of-current-working-directory requires currentWorkingDirectory.
  details: {
    reason: "ancestor-of-current-working-directory",
    resolvedOutputDir: "/workspace/packages",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/generated",
  // @ts-expect-error symbolic-link requires canonicalOutputDir.
  details: {
    reason: "symbolic-link",
    resolvedOutputDir: "/workspace/generated",
    currentWorkingDirectory: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/other-workspace",
  // @ts-expect-error target-carries-workspace-marker requires protectedWorkspaceRoot.
  details: {
    reason: "target-carries-workspace-marker",
    resolvedOutputDir: "/other-workspace",
    currentWorkingDirectory: "/workspace",
  },
});
new UnsafeCleanTargetError({
  outputDir: "/workspace/spec",
  // @ts-expect-error contains-input-file requires inputFile.
  details: {
    reason: "contains-input-file",
    resolvedOutputDir: "/workspace/spec",
    currentWorkingDirectory: "/workspace",
  },
});
