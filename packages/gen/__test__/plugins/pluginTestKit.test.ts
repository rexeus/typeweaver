import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { Cause, Effect, Exit } from "effect";
import { describe, expect, test } from "vitest";
import {
  PluginExecutionError,
  createPluginTestKit,
  definePlugin,
  normalizeSpec,
} from "../../src/index.js";
import type { Issue, NormalizedSpec } from "../../src/index.js";

const normalizedFixture = (): NormalizedSpec =>
  Effect.runSync(
    normalizeSpec(
      defineSpec({
        metadata: { title: "Plugin Test API", version: "1.0.0" },
        resources: {
          health: {
            operations: [
              defineOperation({
                operationId: "getHealth",
                method: HttpMethod.GET,
                path: "/health",
                summary: "Get health",
                request: {},
                responses: [
                  defineResponse({
                    name: "GetHealthResponse",
                    statusCode: HttpStatusCode.OK,
                    description: "Healthy",
                  }),
                ],
              }),
            ],
          },
        },
      })
    )
  );

const validationIssue: Issue = {
  code: "TW-PLUGIN-TEST-001",
  severity: "warning",
  message: "Characterized plugin warning",
  path: "/resources/0",
  hint: "Use the public issue surface.",
  fixable: false,
};

describe("createPluginTestKit lifecycle", () => {
  test("runs validation and the complete lifecycle against inspectable in-memory files", () => {
    const events: string[] = [];
    const kit = createPluginTestKit({
      normalizedSpec: normalizedFixture(),
      templates: {
        "Greeting.ejs": "hello <%= name %>\n",
      },
    });
    const plugin = definePlugin({
      name: "public-test-kit",
      validate: () =>
        Effect.sync(() => {
          events.push("validate");
          return [validationIssue];
        }),
      initialize: () =>
        Effect.sync(() => {
          events.push("initialize");
        }),
      collectResources: spec =>
        Effect.sync(() => {
          events.push("collectResources");
          return spec;
        }),
      generate: context =>
        Effect.gen(function* () {
          events.push("generate");
          const greeting = yield* context.renderTemplateEffect("Greeting.ejs", {
            name: "TypeWeaver",
          });
          yield* context.writeFileEffect("plugin/greeting.txt", greeting);
          context.writeFile("plugin/sync.txt", "sync\n");
        }).pipe(
          Effect.mapError(
            cause =>
              new PluginExecutionError({
                pluginName: "public-test-kit",
                phase: "generate",
                cause,
              })
          )
        ),
      finalize: () =>
        Effect.sync(() => {
          events.push("finalize");
        }),
    });

    const result = Effect.runSync(kit.run(plugin));

    expect(events).toEqual([
      "validate",
      "initialize",
      "collectResources",
      "generate",
      "finalize",
    ]);
    expect(result.issues).toEqual([validationIssue]);
    expect(result.generatedFiles).toEqual([
      "plugin/greeting.txt",
      "plugin/sync.txt",
    ]);
    expect(result.files).toEqual([
      { path: "plugin/greeting.txt", content: "hello TypeWeaver\n" },
      { path: "plugin/sync.txt", content: "sync\n" },
    ]);
    expect(result.finalizeErrors).toEqual([]);
  });
});

describe("createPluginTestKit path safety", () => {
  test("rejects unsafe writes without touching the in-memory output", () => {
    const kit = createPluginTestKit({
      normalizedSpec: normalizedFixture(),
    });
    const plugin = definePlugin({
      name: "unsafe-writer",
      generate: context =>
        context.writeFileEffect("../escape.txt", "blocked").pipe(
          Effect.mapError(
            cause =>
              new PluginExecutionError({
                pluginName: "unsafe-writer",
                phase: "generate",
                cause,
              })
          )
        ),
    });

    const exit = Effect.runSyncExit(kit.run(plugin));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.failureOption(exit.cause)).toMatchObject({
        _tag: "Some",
        value: {
          _tag: "PluginExecutionError",
          phase: "generate",
          cause: {
            _tag: "UnsafeGeneratedPathError",
            reason: "parent-traversal",
          },
        },
      });
    }
    expect(kit.files.list()).toEqual([]);
  });
});

describe("createPluginTestKit finalization", () => {
  test("finalizes after a typed generation failure and exposes best-effort finalizer failures", () => {
    const events: string[] = [];
    const kit = createPluginTestKit({
      normalizedSpec: normalizedFixture(),
    });
    const generationFailure = new PluginExecutionError({
      pluginName: "failing-plugin",
      phase: "generate",
      cause: new Error("generation failed"),
    });
    const finalizerFailure = new PluginExecutionError({
      pluginName: "failing-plugin",
      phase: "finalize",
      cause: new Error("finalizer failed"),
    });
    const plugin = definePlugin({
      name: "failing-plugin",
      initialize: () =>
        Effect.sync(() => {
          events.push("initialize");
        }),
      generate: () => Effect.fail(generationFailure),
      finalize: () =>
        Effect.sync(() => {
          events.push("finalize");
        }).pipe(Effect.zipRight(Effect.fail(finalizerFailure))),
    });

    const exit = Effect.runSyncExit(kit.run(plugin));

    expect(events).toEqual(["initialize", "finalize"]);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBe(generationFailure);
      }
    }
    expect(kit.finalizeErrors()).toEqual([finalizerFailure]);
  });
});
