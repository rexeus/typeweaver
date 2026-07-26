import {
  ContextBuilder,
  TemplateRenderError,
  UnsafeGeneratedPathError,
} from "@rexeus/typeweaver-gen";
import type { NormalizedSpec } from "@rexeus/typeweaver-gen";
import { FileSystem } from "@effect/platform";
import { Effect, Either, Layer } from "effect";
import { makeInMemoryFileSystem } from "test-utils/src/effect/index.js";
import { describe, expect, test } from "vitest";

const emptySpec: NormalizedSpec = {
  metadata: { title: "Empty API", version: "1.0.0" },
  securitySchemes: [],
  security: { requirements: [], source: "none" },
  resources: [],
  responses: [],
  warnings: [],
};

/**
 * Builds a generator context against an isolated in-memory FileSystem and
 * returns both the built context handle and the filesystem state for
 * assertions. Everything runs through the production `ContextBuilder`
 * wiring — the same path plugins exercise via `context.writeFileEffect`.
 */
const buildContext = async () => {
  const { layer, state } = makeInMemoryFileSystem();
  const built = await Effect.runPromise(
    Effect.gen(function* () {
      const builder = yield* ContextBuilder;
      return yield* builder.buildGeneratorContext({
        outputDir: "/project/generated",
        inputDir: "/project/definitions",
        config: {},
        normalizedSpec: emptySpec,
        templateDir: "/project/templates",
        coreDir: "@rexeus/typeweaver-core",
        responsesOutputDir: "/project/generated/responses",
        specOutputDir: "/project/generated/spec",
      });
    }).pipe(Effect.provide(ContextBuilder.Default.pipe(Layer.provide(layer))))
  );
  return { built, layer, state };
};

describe("Effect-native plugin context surface against InMemoryFileSystem", () => {
  test("writeFileEffect writes through the FileSystem service, tracks, and queues the log line", async () => {
    const { built, state } = await buildContext();

    await Effect.runPromise(
      built.context.writeFileEffect(
        "todo/GetTodoClient.ts",
        "export const client = true;\n"
      )
    );

    expect(state.readFile("/project/generated/todo/GetTodoClient.ts")).toBe(
      "export const client = true;\n"
    );
    expect(built.context.getGeneratedFiles()).toEqual([
      "todo/GetTodoClient.ts",
    ]);
    expect(built.drainPendingWriteLogs()).toEqual(["todo/GetTodoClient.ts"]);
    // The scoped temp dir from the atomic replace must not survive.
    expect(
      state.listDirectories().filter(dir => dir.includes(".typeweaver-"))
    ).toEqual([]);
  });

  test("writeFileEffect preserves the existing file mode on replace", async () => {
    const { built, layer, state } = await buildContext();

    await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory("/project/generated/todo", {
          recursive: true,
        });
        yield* fileSystem.writeFileString(
          "/project/generated/todo/GetTodoClient.ts",
          "export const client = false;\n"
        );
        yield* fileSystem.chmod(
          "/project/generated/todo/GetTodoClient.ts",
          0o755
        );
      }).pipe(Effect.provide(layer))
    );

    await Effect.runPromise(
      built.context.writeFileEffect(
        "todo/GetTodoClient.ts",
        "export const client = true;\n"
      )
    );

    expect(state.readFile("/project/generated/todo/GetTodoClient.ts")).toBe(
      "export const client = true;\n"
    );
    expect(state.fileMode("/project/generated/todo/GetTodoClient.ts")).toBe(
      0o755
    );
  });

  test("writeFileEffect rejects parent traversal on the typed error channel", async () => {
    const { built, state } = await buildContext();

    const either = await Effect.runPromise(
      Effect.either(built.context.writeFileEffect("../escape.ts", "nope"))
    );

    expect(Either.isLeft(either)).toBe(true);
    if (!Either.isLeft(either)) return;
    expect(either.left).toBeInstanceOf(UnsafeGeneratedPathError);
    expect(either.left).toMatchObject({ reason: "parent-traversal" });
    expect(state.listFiles()).toEqual([]);
  });
});

describe("Effect-native template context against InMemoryFileSystem", () => {
  test("renderTemplateEffect reads the template through the FileSystem service", async () => {
    const { built, layer } = await buildContext();

    await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory("/project/templates", {
          recursive: true,
        });
        yield* fileSystem.writeFileString(
          "/project/templates/Greeting.ejs",
          "Hello <%= name %>!"
        );
      }).pipe(Effect.provide(layer))
    );

    const rendered = await Effect.runPromise(
      built.context.renderTemplateEffect("Greeting.ejs", { name: "Bob" })
    );

    expect(rendered).toBe("Hello Bob!");
  });

  test("renderTemplateEffect surfaces a missing template as a typed platform error", async () => {
    const { built } = await buildContext();

    const either = await Effect.runPromise(
      Effect.either(built.context.renderTemplateEffect("Missing.ejs", {}))
    );

    expect(Either.isLeft(either)).toBe(true);
    if (!Either.isLeft(either)) return;
    expect(either.left).toMatchObject({ _tag: "SystemError" });
  });

  test("renderTemplateEffect surfaces a broken template as TemplateRenderError", async () => {
    const { built, layer } = await buildContext();

    await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        yield* fileSystem.makeDirectory("/project/templates", {
          recursive: true,
        });
        yield* fileSystem.writeFileString(
          "/project/templates/Broken.ejs",
          "<%= callsSomethingUndefined() %>"
        );
      }).pipe(Effect.provide(layer))
    );

    const either = await Effect.runPromise(
      Effect.either(built.context.renderTemplateEffect("Broken.ejs", {}))
    );

    expect(Either.isLeft(either)).toBe(true);
    if (!Either.isLeft(either)) return;
    expect(either.left).toBeInstanceOf(TemplateRenderError);
  });
});

describe("Effect-native generated-file tracking against InMemoryFileSystem", () => {
  test("addGeneratedFileEffect tracks without writing and rejects unsafe paths", async () => {
    const { built, state } = await buildContext();

    await Effect.runPromise(
      built.context.addGeneratedFileEffect("lib/types/index.ts")
    );
    expect(built.context.getGeneratedFiles()).toEqual(["lib/types/index.ts"]);
    expect(state.listFiles()).toEqual([]);

    const either = await Effect.runPromise(
      Effect.either(built.context.addGeneratedFileEffect("/absolute.ts"))
    );
    expect(Either.isLeft(either)).toBe(true);
    if (!Either.isLeft(either)) return;
    expect(either.left).toBeInstanceOf(UnsafeGeneratedPathError);
  });
});
