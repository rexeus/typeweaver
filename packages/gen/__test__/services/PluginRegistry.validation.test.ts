import { Cause, Effect, Exit, Layer, Logger, Tracer } from "effect";
import { describe, expect, test } from "vitest";
import {
  DuplicateOperationIdError,
  normalizationErrorToIssue,
  SPEC_ISSUE_REGISTRY,
} from "../../src/index.js";
import {
  PluginDependencyError,
  PluginExecutionError,
} from "../../src/plugins/errors/index.js";
import { PluginRegistry } from "../../src/services/PluginRegistry.js";
import type {
  Issue,
  NormalizedSpec,
  Plugin,
  PluginValidationContext,
} from "../../src/index.js";
import type { PluginRegistryInstance } from "../../src/services/PluginRegistry.js";

const silentLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  Logger.make<unknown, void>(() => {})
);

const registryTestLayer = Layer.merge(
  PluginRegistry.Default,
  silentLoggerLayer
);

const normalizedSpec: NormalizedSpec = {
  metadata: { title: "Validation API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

const validationContext: PluginValidationContext = {
  inputDir: "/workspace/spec",
  config: { input: "spec/index.ts" },
};

type CapturedSpan = {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, unknown>;
};

const makeCapturingTracer = (recorded: CapturedSpan[]): Tracer.Tracer => {
  let nextSpanId = 0;
  return Tracer.make({
    span: (...args: Parameters<Tracer.Tracer["span"]>) => {
      const [name, parent, context, links, startTime, kind] = args;
      nextSpanId += 1;
      const attributes = new Map<string, unknown>();
      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId: String(nextSpanId),
        traceId: "validation-trace",
        parent,
        context,
        status: { _tag: "Started", startTime },
        attributes,
        links,
        sampled: true,
        kind,
        end: () => undefined,
        attribute: (key, value) => {
          attributes.set(key, value);
        },
        event: () => undefined,
        addLinks: () => undefined,
      };
      recorded.push({ name, attributes });
      return span;
    },
    context: (evaluate, _fiber) => evaluate(),
  });
};

const runRegistry = <A, E>(
  program: (registry: PluginRegistryInstance) => Effect.Effect<A, E>
): A =>
  Effect.runSync(
    Effect.gen(function* () {
      const registry = yield* PluginRegistry.createInstance();
      return yield* program(registry);
    }).pipe(Effect.provide(registryTestLayer))
  );

const runRegistryExpectingFailure = <E>(
  program: (registry: PluginRegistryInstance) => Effect.Effect<unknown, E>
): E => {
  const exit = Effect.runSyncExit(
    Effect.gen(function* () {
      const registry = yield* PluginRegistry.createInstance();
      return yield* program(registry);
    }).pipe(Effect.provide(registryTestLayer))
  );

  if (Exit.isSuccess(exit)) {
    throw new Error("Expected plugin validation to fail.");
  }

  const failure = Cause.failureOption(exit.cause);
  if (failure._tag !== "Some") {
    throw new Error(`Expected typed failure: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};

const anIssue = (code: Issue["code"], message: string): Issue => ({
  code,
  severity: "warning",
  message,
  path: "",
  hint: "Review the contract.",
  fixable: false,
});

const registerPlugins = (
  registry: PluginRegistryInstance,
  plugins: readonly Plugin[]
): Effect.Effect<void> =>
  Effect.forEach(plugins, plugin => registry.register(plugin), {
    discard: true,
  });

const validateRegisteredPlugins = (
  registry: PluginRegistryInstance
): Effect.Effect<
  readonly Issue[],
  PluginDependencyError | PluginExecutionError
> =>
  registry.validate({
    normalizedSpec,
    context: validationContext,
  });

describe("PluginRegistry validation lifecycle", () => {
  test("runs optional validation hooks in dependency order and preserves issue order", () => {
    const calls: string[] = [];
    const plugins: readonly Plugin[] = [
      {
        name: "consumer",
        depends: ["foundation"],
        validate: () => {
          calls.push("consumer");
          return Effect.succeed([
            anIssue("TW-PLUGIN-CONSUMER-001", "Consumer first"),
            anIssue("TW-PLUGIN-CONSUMER-002", "Consumer second"),
          ]);
        },
      },
      {
        name: "foundation",
        validate: (_spec, context) => {
          calls.push(`foundation:${context.inputDir}`);
          return Effect.succeed([
            anIssue("TW-PLUGIN-FOUNDATION-001", "Foundation"),
          ]);
        },
      },
      { name: "legacy" },
    ];

    const issues = runRegistry(registry =>
      Effect.gen(function* () {
        yield* registerPlugins(registry, plugins);
        return yield* validateRegisteredPlugins(registry);
      })
    );

    expect(calls).toEqual(["foundation:/workspace/spec", "consumer"]);
    expect(issues.map(issue => issue.code)).toEqual([
      "TW-PLUGIN-FOUNDATION-001",
      "TW-PLUGIN-CONSUMER-001",
      "TW-PLUGIN-CONSUMER-002",
    ]);
  });

  test("keeps validation state isolated between registry instances", () => {
    const issue = anIssue("TW-PLUGIN-FIRST-001", "First registry");

    const result = Effect.runSync(
      Effect.gen(function* () {
        const first = yield* PluginRegistry.createInstance();
        const second = yield* PluginRegistry.createInstance();
        yield* first.register({
          name: "first",
          validate: () => Effect.succeed([issue]),
        });

        return {
          first: yield* first.validate({
            normalizedSpec,
            context: validationContext,
          }),
          second: yield* second.validate({
            normalizedSpec,
            context: validationContext,
          }),
        };
      }).pipe(Effect.provide(registryTestLayer))
    );

    expect(result.first).toEqual([issue]);
    expect(result.second).toEqual([]);
  });
});

describe("PluginRegistry validation failures and tracing", () => {
  test("preserves typed plugin validation failures", () => {
    const failure = new PluginExecutionError({
      pluginName: "broken",
      phase: "validate",
      cause: new Error("invalid projection"),
    });

    const actual = runRegistryExpectingFailure(registry =>
      Effect.gen(function* () {
        yield* registry.register({
          name: "broken",
          validate: () => Effect.fail(failure),
        });
        return yield* validateRegisteredPlugins(registry);
      })
    );

    expect(actual).toBeInstanceOf(PluginExecutionError);
    expect(actual).toMatchObject({
      pluginName: "broken",
      phase: "validate",
    });
  });

  test("traces the registry phase and every implemented plugin hook", () => {
    const spans: CapturedSpan[] = [];

    runRegistry(registry =>
      Effect.gen(function* () {
        yield* registry.register({
          name: "observable",
          validate: () => Effect.succeed([]),
        });
        yield* registry.register({ name: "legacy" });
        return yield* validateRegisteredPlugins(registry).pipe(
          Effect.withTracer(makeCapturingTracer(spans))
        );
      })
    );

    expect(spans.map(span => span.name)).toContain(
      "typeweaver.PluginRegistry.validate"
    );
    const pluginSpan = spans.find(
      span => span.name === "typeweaver.plugin.validate"
    );
    expect(pluginSpan?.attributes.get("plugin")).toBe("observable");
  });
});

describe("stable spec issue registry", () => {
  test("uses unique sequential codes for every normalization error tag", () => {
    const entries = Object.values(SPEC_ISSUE_REGISTRY);

    expect(entries.map(entry => entry.code)).toEqual(
      entries.map(
        (_entry, index) => `TW-SPEC-${String(index + 1).padStart(3, "0")}`
      )
    );
    expect(new Set(entries.map(entry => entry.code)).size).toBe(entries.length);
  });

  test("maps known errors to issues and leaves unknown errors unmapped", () => {
    const known = normalizationErrorToIssue(
      new DuplicateOperationIdError({ operationId: "getTodo" })
    );

    expect(known).toMatchObject({
      code: "TW-SPEC-003",
      severity: "error",
      path: "/resources",
      fixable: false,
    });
    expect(normalizationErrorToIssue(new Error("unknown"))).toBeUndefined();
  });
});
