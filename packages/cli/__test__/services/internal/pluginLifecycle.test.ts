import { ContextBuilder, PluginExecutionError } from "@rexeus/typeweaver-gen";
import type {
  GeneratorContext,
  NormalizedSpec,
  Plugin,
  PluginContext,
  PluginRegistration,
} from "@rexeus/typeweaver-gen";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { describe, expect } from "vitest";
import { IndexFileGenerator } from "../../../src/services/IndexFileGenerator.js";
import { runPluginLifecycle } from "../../../src/services/internal/pluginLifecycle.js";
import type { GenerationPlan } from "../../../src/services/internal/generatorPreflight.js";

const emptySpec = (): NormalizedSpec => ({
  resources: [],
  responses: [],
  warnings: [],
});

const plan: GenerationPlan = {
  params: {
    inputFile: "spec/index.ts",
    outputDir: "generated/output",
    config: {
      input: "spec/index.ts",
      output: "generated/output",
      format: false,
    },
    currentWorkingDirectory: "/workspace",
  },
  cwd: "/workspace",
  inputFile: "/workspace/spec/index.ts",
  inputDir: "/workspace/spec",
  outputDir: "/workspace/generated/output",
  responsesOutputDir: "/workspace/generated/output/responses",
  specOutputDir: "/workspace/generated/output/spec",
  templateDir: "/workspace/templates",
  userConfig: {
    input: "spec/index.ts",
    output: "generated/output",
    format: false,
  },
};

const pluginContext: PluginContext = {
  outputDir: plan.outputDir,
  inputDir: plan.inputDir,
  config: plan.userConfig,
};

const makeBuiltContext = (normalizedSpec: NormalizedSpec) => {
  const generatedFiles: string[] = [];
  const pendingWriteLogs: string[] = [];

  const recordGeneratedFile = (relativePath: string): void => {
    if (!generatedFiles.includes(relativePath)) {
      generatedFiles.push(relativePath);
    }
    pendingWriteLogs.push(relativePath);
  };

  const context: GeneratorContext = {
    ...pluginContext,
    normalizedSpec,
    coreDir: "/workspace/core",
    responsesOutputDir: plan.responsesOutputDir,
    specOutputDir: plan.specOutputDir,
    getCanonicalResponse: () => {
      throw new Error("Canonical responses are outside this test contract");
    },
    getCanonicalResponseOutputFile: responseName =>
      `${plan.responsesOutputDir}/${responseName}.ts`,
    getCanonicalResponseImportPath: ({ responseName }) =>
      `./responses/${responseName}.js`,
    getSpecImportPath: () => "./spec/spec.js",
    getOperationDefinitionAccessor: ({ resourceName, operationId }) =>
      `${resourceName}.${operationId}`,
    getOperationOutputPaths: ({ resourceName, operationId }) => ({
      outputDir: `${plan.outputDir}/${resourceName}`,
      requestFile: `${operationId}Request.ts`,
      requestFileName: `${operationId}Request`,
      responseFile: `${operationId}Response.ts`,
      responseFileName: `${operationId}Response`,
      requestValidationFile: `${operationId}RequestValidator.ts`,
      requestValidationFileName: `${operationId}RequestValidator`,
      responseValidationFile: `${operationId}ResponseValidator.ts`,
      responseValidationFileName: `${operationId}ResponseValidator`,
      clientFile: `${operationId}Client.ts`,
      clientFileName: `${operationId}Client`,
    }),
    getResourceOutputDir: resourceName => `${plan.outputDir}/${resourceName}`,
    writeFile: relativePath => recordGeneratedFile(relativePath),
    renderTemplate: () => "",
    addGeneratedFile: recordGeneratedFile,
    getGeneratedFiles: () => [...generatedFiles],
    writeFileEffect: relativePath =>
      Effect.sync(() => recordGeneratedFile(relativePath)),
    renderTemplateEffect: () => Effect.succeed(""),
    addGeneratedFileEffect: relativePath =>
      Effect.sync(() => recordGeneratedFile(relativePath)),
  };

  return {
    context,
    getGeneratedFiles: (): readonly string[] => [...generatedFiles],
    drainPendingWriteLogs: (): readonly string[] => {
      const drained = [...pendingWriteLogs];
      pendingWriteLogs.length = 0;
      return drained;
    },
  };
};

const registration = (plugin: Plugin): PluginRegistration => ({
  name: plugin.name,
  plugin,
});

describe("runPluginLifecycle", () => {
  it.effect(
    "preserves phase barriers, forwards the transformed spec, indexes the final snapshot, and finalizes in reverse order",
    () =>
      Effect.gen(function* () {
        const events: string[] = [];
        const initialSpec = emptySpec();
        const transformedSpec: NormalizedSpec = emptySpec();

        const alpha = {
          name: "alpha",
          initialize: () =>
            Effect.sync(() => {
              events.push("initialize:alpha");
            }),
          collectResources: () =>
            Effect.sync(() => {
              events.push("collect:alpha");
              return transformedSpec;
            }),
          generate: context =>
            Effect.sync(() => {
              events.push("generate:alpha");
              context.writeFile("alpha.ts", "alpha");
            }),
          finalize: () =>
            Effect.sync(() => {
              events.push("finalize:alpha");
            }),
        } satisfies Plugin;
        const beta = {
          name: "beta",
          initialize: () =>
            Effect.sync(() => {
              events.push("initialize:beta");
            }),
          collectResources: normalizedSpec =>
            Effect.sync(() => {
              expect(normalizedSpec).toBe(transformedSpec);
              events.push("collect:beta");
              return normalizedSpec;
            }),
          generate: context =>
            Effect.sync(() => {
              expect(context.normalizedSpec).toBe(transformedSpec);
              events.push("generate:beta");
            }),
          finalize: () =>
            Effect.sync(() => {
              events.push("finalize:beta");
            }),
        } satisfies Plugin;

        const contextBuilder = ContextBuilder.make({
          buildPluginContext: () => Effect.succeed(pluginContext),
          buildGeneratorContext: params =>
            Effect.sync(() => {
              expect(params.normalizedSpec).toBe(transformedSpec);
              events.push("build-context");
              return makeBuiltContext(params.normalizedSpec);
            }),
        });
        const indexFileGenerator = IndexFileGenerator.make({
          generate: params =>
            Effect.sync(() => {
              events.push(`index:${params.generatedFiles.join(",")}`);
              params.writeFile("index.ts", "index");
            }),
        });

        const result = yield* runPluginLifecycle(
          {
            plan,
            initial: [registration(alpha), registration(beta)],
            normalizedSpec: initialSpec,
            pluginContext,
          },
          { contextBuilder, indexFileGenerator }
        );

        expect(events).toEqual([
          "initialize:alpha",
          "initialize:beta",
          "collect:alpha",
          "collect:beta",
          "build-context",
          "generate:alpha",
          "generate:beta",
          "index:alpha.ts",
          "finalize:beta",
          "finalize:alpha",
        ]);
        expect(result.generatedFiles).toEqual(["alpha.ts", "index.ts"]);
      })
  );

  describe.each([
    "initialize-failure",
    "generate-failure",
    "generate-interruption",
  ] as const)("%s", scenario => {
    it.effect(
      "finalizes only successfully initialized plugins exactly once and preserves the original exit",
      () =>
        Effect.gen(function* () {
          const events: string[] = [];
          const interruptEntered = yield* Deferred.make<void>();
          const neverRelease = yield* Deferred.make<void>();
          const failureCause = new Error(`intentional ${scenario}`);
          const failure = new PluginExecutionError({
            pluginName: "beta",
            phase:
              scenario === "initialize-failure" ? "initialize" : "generate",
            cause: failureCause,
          });

          const makePlugin = (name: "alpha" | "beta" | "omega"): Plugin => ({
            name,
            initialize: () =>
              Effect.sync(() => {
                events.push(`initialize:${name}`);
              }).pipe(
                Effect.zipRight(
                  name === "beta" && scenario === "initialize-failure"
                    ? Effect.fail(failure)
                    : Effect.void
                )
              ),
            generate: () =>
              Effect.sync(() => {
                events.push(`generate:${name}`);
              }).pipe(
                Effect.zipRight(
                  name !== "beta"
                    ? Effect.void
                    : scenario === "generate-failure"
                      ? Effect.fail(failure)
                      : scenario === "generate-interruption"
                        ? Deferred.succeed(interruptEntered, undefined).pipe(
                            Effect.zipRight(Deferred.await(neverRelease))
                          )
                        : Effect.void
                )
              ),
            finalize: () =>
              Effect.sync(() => {
                events.push(`finalize:${name}`);
              }),
          });
          const plugins = [
            makePlugin("alpha"),
            makePlugin("beta"),
            makePlugin("omega"),
          ];
          const contextBuilder = ContextBuilder.make({
            buildPluginContext: () => Effect.succeed(pluginContext),
            buildGeneratorContext: params =>
              Effect.succeed(makeBuiltContext(params.normalizedSpec)),
          });
          let indexRuns = 0;
          const indexFileGenerator = IndexFileGenerator.make({
            generate: () =>
              Effect.sync(() => {
                indexRuns += 1;
              }),
          });
          const lifecycle = runPluginLifecycle(
            {
              plan,
              initial: plugins.map(registration),
              normalizedSpec: emptySpec(),
              pluginContext,
            },
            { contextBuilder, indexFileGenerator }
          );

          const exit =
            scenario === "generate-interruption"
              ? yield* Effect.gen(function* () {
                  const fiber = yield* Effect.fork(lifecycle);
                  yield* Deferred.await(interruptEntered);
                  return yield* Fiber.interrupt(fiber);
                })
              : yield* Effect.exit(lifecycle);

          expect(Exit.isFailure(exit)).toBe(true);
          if (!Exit.isFailure(exit)) return;
          if (scenario === "generate-interruption") {
            expect(Cause.isInterruptedOnly(exit.cause)).toBe(true);
          } else {
            const observedFailure = Cause.failureOption(exit.cause);
            expect(Option.isSome(observedFailure)).toBe(true);
            if (!Option.isSome(observedFailure)) return;
            expect(observedFailure.value).toBeInstanceOf(PluginExecutionError);
            if (!(observedFailure.value instanceof PluginExecutionError)) {
              return;
            }
            expect(observedFailure.value.pluginName).toBe("beta");
            expect(observedFailure.value.phase).toBe(failure.phase);
            expect(Cause.originalError(observedFailure.value.cause)).toBe(
              failureCause
            );
          }

          expect(events.filter(event => event.startsWith("finalize:"))).toEqual(
            scenario === "initialize-failure"
              ? ["finalize:alpha"]
              : ["finalize:omega", "finalize:beta", "finalize:alpha"]
          );
          expect(indexRuns).toBe(0);
        })
    );
  });
});
