import { PluginConfigError } from "@rexeus/typeweaver-gen";
import type { Plugin, PluginConfig } from "@rexeus/typeweaver-gen";
import { Result } from "effect";
import { isPluginConfigError } from "./isPluginConfigError.js";

export type PluginCandidate = {
  readonly exportName: string;
  readonly value: unknown;
};

export type PluginLoadResult = {
  readonly plugin: Plugin;
  readonly source: string;
  readonly config?: PluginConfig | undefined;
};

type PluginFactory = (config?: PluginConfig) => unknown;

type PluginShapeIssue =
  | { readonly _tag: "NotRecord"; readonly actual: string }
  | {
      readonly _tag: "InvalidField";
      readonly field: keyof Plugin;
      readonly expected: string;
      readonly actual: string;
      readonly detail?: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPluginFactory = (value: unknown): value is PluginFactory =>
  typeof value === "function";

const isInitializeHook = (
  value: unknown
): value is NonNullable<Plugin["initialize"]> => typeof value === "function";
const isValidateHook = (
  value: unknown
): value is NonNullable<Plugin["validate"]> => typeof value === "function";
const isCollectResourcesHook = (
  value: unknown
): value is NonNullable<Plugin["collectResources"]> =>
  typeof value === "function";
const isGenerateHook = (
  value: unknown
): value is NonNullable<Plugin["generate"]> => typeof value === "function";
const isFinalizeHook = (
  value: unknown
): value is NonNullable<Plugin["finalize"]> => typeof value === "function";

const describeValue = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return JSON.stringify(value);
  return typeof value;
};

const formatPluginShapeIssue = (
  exportName: string,
  issue: PluginShapeIssue
): string => {
  switch (issue._tag) {
    case "NotRecord":
      return `Export '${exportName}' must be a plugin record, received ${issue.actual}`;
    case "InvalidField": {
      const detail = issue.detail === undefined ? "" : ` ${issue.detail}`;
      return `Export '${exportName}' has invalid plugin field '${issue.field}'${detail}: expected ${issue.expected}, received ${issue.actual}`;
    }
  }
};

const invalidField = (
  field: keyof Plugin,
  expected: string,
  actual: unknown,
  detail?: string
): Result.Result<never, PluginShapeIssue> =>
  Result.fail({
    _tag: "InvalidField",
    field,
    expected,
    actual: describeValue(actual),
    ...(detail === undefined ? {} : { detail }),
  });

const decodePluginName = (
  value: Record<string, unknown>
): Result.Result<string, PluginShapeIssue> => {
  const name = value["name"];
  return typeof name === "string" && name.trim().length > 0
    ? Result.succeed(name)
    : invalidField("name", "a non-empty string", name);
};

const decodeDependencies = (
  value: Record<string, unknown>
): Result.Result<readonly string[] | undefined, PluginShapeIssue> => {
  if (!("depends" in value)) return Result.succeed(undefined);
  if (!Array.isArray(value["depends"])) {
    return invalidField("depends", "an array of strings", value["depends"]);
  }
  const dependencies: string[] = [];
  for (const [index, dependency] of value["depends"].entries()) {
    if (typeof dependency !== "string") {
      return invalidField(
        "depends",
        "a string",
        dependency,
        `at index ${index}`
      );
    }
    dependencies.push(dependency);
  }
  return Result.succeed(dependencies);
};

const decodeOptionalHook = <THook>(
  value: Record<string, unknown>,
  field: keyof Plugin,
  isHook: (candidate: unknown) => candidate is THook
): Result.Result<THook | undefined, PluginShapeIssue> => {
  if (!(field in value)) return Result.succeed(undefined);
  const candidate = value[field];
  return isHook(candidate)
    ? Result.succeed(candidate)
    : invalidField(field, "a function", candidate);
};

export const decodePlugin = (
  value: unknown
): Result.Result<Plugin, PluginShapeIssue> => {
  if (!isRecord(value)) {
    return Result.fail({ _tag: "NotRecord", actual: describeValue(value) });
  }

  return Result.gen(function* () {
    const name = yield* decodePluginName(value);
    const depends = yield* decodeDependencies(value);
    const initialize = yield* decodeOptionalHook(
      value,
      "initialize",
      isInitializeHook
    );
    const validate = yield* decodeOptionalHook(
      value,
      "validate",
      isValidateHook
    );
    const collectResources = yield* decodeOptionalHook(
      value,
      "collectResources",
      isCollectResourcesHook
    );
    const generate = yield* decodeOptionalHook(
      value,
      "generate",
      isGenerateHook
    );
    const finalize = yield* decodeOptionalHook(
      value,
      "finalize",
      isFinalizeHook
    );

    return {
      ...value,
      name,
      ...(depends === undefined ? {} : { depends }),
      ...(initialize === undefined ? {} : { initialize }),
      ...(validate === undefined ? {} : { validate }),
      ...(collectResources === undefined ? {} : { collectResources }),
      ...(generate === undefined ? {} : { generate }),
      ...(finalize === undefined ? {} : { finalize }),
    } satisfies Plugin;
  });
};

export const resolveCandidateToPlugin = (
  candidate: PluginCandidate,
  config: PluginConfig | undefined
): Result.Result<Plugin, string | PluginConfigError> => {
  if (isPluginFactory(candidate.value)) {
    try {
      return Result.mapError(decodePlugin(candidate.value(config)), issue =>
        formatPluginShapeIssue(candidate.exportName, issue)
      );
    } catch (error) {
      if (isPluginConfigError(error)) return Result.fail(error);
      return Result.fail(
        `Export '${candidate.exportName}' could not be instantiated: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return Result.mapError(decodePlugin(candidate.value), issue =>
    formatPluginShapeIssue(candidate.exportName, issue)
  );
};
