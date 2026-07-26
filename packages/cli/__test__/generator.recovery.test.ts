import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineSpec } from "@rexeus/typeweaver-core";
import {
  ContextBuilder,
  PluginExecutionError,
  PluginRegistry,
} from "@rexeus/typeweaver-gen";
import type { GeneratorContext, Plugin } from "@rexeus/typeweaver-gen";
import { NodeContext } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Ref } from "effect";
import {
  Formatter,
  Generator,
  IndexFileGenerator,
  PluginLoader,
  SpecLoader,
} from "../src/services/index.js";
import { emptyNormalizedSpec } from "./helpers/generatorFixtures.js";

type RecoveryPhase =
  | "bundling"
  | "initialize"
  | "collectResources"
  | "generate"
  | "format";

type RecoveryMode = "interrupt" | "defect" | "pending-interrupt";

type RecoveryCase = {
  readonly phase: RecoveryPhase;
  readonly mode: RecoveryMode;
};

const recoveryCases: readonly RecoveryCase[] = [
  { phase: "bundling", mode: "interrupt" },
  { phase: "bundling", mode: "defect" },
  { phase: "initialize", mode: "interrupt" },
  { phase: "initialize", mode: "defect" },
  { phase: "initialize", mode: "pending-interrupt" },
  { phase: "collectResources", mode: "interrupt" },
  { phase: "collectResources", mode: "defect" },
  { phase: "generate", mode: "interrupt" },
  { phase: "generate", mode: "defect" },
  { phase: "format", mode: "interrupt" },
  { phase: "format", mode: "defect" },
];

const emptyDefinition = defineSpec({
  metadata: { title: "Empty API", version: "1.0.0" },
  resources: {},
});

const createWorkspace = (): string => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "typeweaver-generator-recovery-")
  );
  const inputFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(inputFile), { recursive: true });
  fs.writeFileSync(
    inputFile,
    "export const spec = { resources: {} };\n",
    "utf8"
  );
  return workspace;
};

const collectOwnedArtifacts = (directory: string): readonly string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const artifacts: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.name.startsWith(".typeweaver-")) {
        artifacts.push(path.relative(directory, entryPath));
      }
      if (entry.isDirectory()) {
        visit(entryPath);
      }
    }
  };

  visit(directory);
  return artifacts.sort();
};

const assertNoOwnedArtifacts = (workspace: string): void => {
  const outputDir = path.join(workspace, "generated", "output");
  assert.deepStrictEqual(collectOwnedArtifacts(outputDir), []);
};

const writeGeneratedFile = (
  pluginName: string,
  context: GeneratorContext
): Effect.Effect<void, PluginExecutionError> =>
  context
    .writeFileEffect(
      `${pluginName}.ts`,
      `export const ${pluginName}Recovered = true;\n`
    )
    .pipe(
      Effect.mapError(
        cause =>
          new PluginExecutionError({
            pluginName,
            phase: "generate",
            cause,
          })
      )
    );

const expectedFirstRunFinalizers = (
  recoveryCase: RecoveryCase
): readonly string[] =>
  recoveryCase.phase === "bundling"
    ? []
    : recoveryCase.phase === "initialize"
      ? ["finalize:alpha"]
      : ["finalize:omega", "finalize:alpha"];

type RecoveryLayerParams = {
  readonly recoveryCase: RecoveryCase;
  readonly entered: Deferred.Deferred<void>;
  readonly release: Deferred.Deferred<void>;
  readonly armed: Ref.Ref<boolean>;
  readonly events: Ref.Ref<readonly string[]>;
  readonly defect: Error;
};

const makeFailureTrigger =
  (params: RecoveryLayerParams) =>
  (phase: RecoveryPhase): Effect.Effect<void, never> => {
    if (phase !== params.recoveryCase.phase) {
      return Effect.void;
    }

    return Effect.gen(function* () {
      const isArmed = yield* Ref.getAndSet(params.armed, false);
      if (!isArmed) {
        return;
      }

      yield* Deferred.succeed(params.entered, undefined);
      yield* Deferred.await(params.release);

      if (params.recoveryCase.mode === "defect") {
        return yield* Effect.die(params.defect);
      }
    });
  };

const makeRecoveryPlugins = (
  params: RecoveryLayerParams,
  record: (event: string) => Effect.Effect<void>,
  failFirstRunAt: (phase: RecoveryPhase) => Effect.Effect<void, never>
): readonly [Plugin, Plugin] => {
  const alpha = {
    name: "alpha",
    initialize: () => record("initialize:alpha"),
    collectResources: normalizedSpec =>
      record("collectResources:alpha").pipe(Effect.as(normalizedSpec)),
    generate: context =>
      record("generate:alpha").pipe(
        Effect.zipRight(writeGeneratedFile("alpha", context))
      ),
    finalize: () => record("finalize:alpha"),
  } satisfies Plugin;

  const omega = {
    name: "omega",
    depends: ["alpha"],
    initialize: () => {
      const initialize = record("initialize:omega").pipe(
        Effect.zipRight(failFirstRunAt("initialize"))
      );
      // A pending interrupt becomes observable as this inner mask ends, so
      // Generator never receives a successful initialize result for omega.
      // Any partial resource acquired behind a plugin-owned mask must be
      // scoped by the plugin itself; only alpha belongs to Generator here.
      return params.recoveryCase.phase === "initialize" &&
        params.recoveryCase.mode === "pending-interrupt"
        ? Effect.uninterruptible(initialize)
        : initialize;
    },
    collectResources: normalizedSpec =>
      record("collectResources:omega").pipe(
        Effect.zipRight(failFirstRunAt("collectResources")),
        Effect.as(normalizedSpec)
      ),
    generate: context =>
      record("generate:omega").pipe(
        Effect.zipRight(failFirstRunAt("generate")),
        Effect.zipRight(writeGeneratedFile("omega", context))
      ),
    finalize: () => record("finalize:omega"),
  } satisfies Plugin;

  return [alpha, omega];
};

const makeRecoveryLayer = (params: RecoveryLayerParams) => {
  const record = (event: string): Effect.Effect<void> =>
    Ref.update(params.events, current => [...current, event]);
  const failFirstRunAt = makeFailureTrigger(params);
  const plugins = makeRecoveryPlugins(params, record, failFirstRunAt);
  const pluginLoaderLayer = Layer.succeed(
    PluginLoader,
    PluginLoader.make({
      loadAll: loadParams =>
        Effect.forEach(
          plugins,
          plugin => loadParams.registry.register(plugin),
          {
            discard: true,
          }
        ),
    })
  );

  const specLoaderLayer = Layer.succeed(
    SpecLoader,
    SpecLoader.make({
      load: () =>
        record("bundling").pipe(
          Effect.zipRight(failFirstRunAt("bundling")),
          Effect.as({
            definition: emptyDefinition,
            normalizedSpec: emptyNormalizedSpec(),
          })
        ),
    })
  );

  const formatterLayer = Layer.succeed(
    Formatter,
    Formatter.make({
      format: () =>
        record("format").pipe(Effect.zipRight(failFirstRunAt("format"))),
    })
  );

  const indexFileGeneratorLayer = Layer.succeed(
    IndexFileGenerator,
    IndexFileGenerator.make({
      generate: () => Effect.void,
    })
  );

  const dependencies = Layer.mergeAll(
    ContextBuilder.Default,
    formatterLayer,
    indexFileGeneratorLayer,
    pluginLoaderLayer,
    PluginRegistry.Default,
    specLoaderLayer
  );
  const dependenciesWithNode = Layer.provideMerge(
    dependencies,
    NodeContext.layer
  );

  return Layer.provideMerge(
    Generator.DefaultWithoutDependencies,
    dependenciesWithNode
  );
};

const runRecoveryScenario = (recoveryCase: RecoveryCase) =>
  Effect.acquireUseRelease(
    Effect.sync(createWorkspace),
    workspace =>
      Effect.gen(function* () {
        const entered = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const armed = yield* Ref.make(true);
        const events = yield* Ref.make<readonly string[]>([]);
        const defect = new Error(
          `intentional ${recoveryCase.phase} recovery defect`
        );
        const layer = makeRecoveryLayer({
          recoveryCase,
          entered,
          release,
          armed,
          events,
          defect,
        });
        const outputDir = path.join(workspace, "generated", "output");
        const generate = Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: true,
          },
          currentWorkingDirectory: workspace,
        });

        yield* Effect.gen(function* () {
          const firstFiber = yield* Effect.fork(generate);
          yield* Deferred.await(entered);

          const firstExit =
            recoveryCase.mode === "interrupt"
              ? yield* Fiber.interrupt(firstFiber)
              : recoveryCase.mode === "pending-interrupt"
                ? yield* Fiber.interruptFork(firstFiber).pipe(
                    Effect.zipRight(Deferred.succeed(release, undefined)),
                    Effect.zipRight(Fiber.await(firstFiber))
                  )
                : yield* Deferred.succeed(release, undefined).pipe(
                    Effect.zipRight(Fiber.await(firstFiber))
                  );

          assert.isTrue(Exit.isFailure(firstExit));
          if (Exit.isSuccess(firstExit)) {
            return;
          }

          if (
            recoveryCase.mode === "interrupt" ||
            recoveryCase.mode === "pending-interrupt"
          ) {
            assert.isTrue(Cause.isInterruptedOnly(firstExit.cause));
          } else {
            assert.isTrue(Cause.isDieType(firstExit.cause));
            if (!Cause.isDieType(firstExit.cause)) {
              return;
            }
            assert.strictEqual(
              Cause.originalError(firstExit.cause.defect),
              defect
            );
          }

          assertNoOwnedArtifacts(workspace);
          const firstRunFinalizers = (yield* Ref.get(events)).filter(event =>
            event.startsWith("finalize:")
          );
          assert.deepStrictEqual(
            firstRunFinalizers,
            expectedFirstRunFinalizers(recoveryCase)
          );

          yield* generate;

          assertNoOwnedArtifacts(workspace);
          assert.strictEqual(
            fs.readFileSync(path.join(outputDir, "alpha.ts"), "utf8"),
            "export const alphaRecovered = true;\n"
          );
          assert.strictEqual(
            fs.readFileSync(path.join(outputDir, "omega.ts"), "utf8"),
            "export const omegaRecovered = true;\n"
          );

          const allFinalizers = (yield* Ref.get(events)).filter(event =>
            event.startsWith("finalize:")
          );
          assert.deepStrictEqual(allFinalizers, [
            ...expectedFirstRunFinalizers(recoveryCase),
            "finalize:omega",
            "finalize:alpha",
          ]);
        }).pipe(Effect.provide(layer));
      }),
    workspace =>
      Effect.sync(() => {
        fs.rmSync(workspace, { recursive: true, force: true });
      })
  );

describe.each(recoveryCases)(
  "Generator recovery during $phase ($mode)",
  recoveryCase => {
    it.effect(
      "cleans owned resources and permits a second generation in the same runtime",
      () => runRecoveryScenario(recoveryCase),
      10_000
    );
  }
);
