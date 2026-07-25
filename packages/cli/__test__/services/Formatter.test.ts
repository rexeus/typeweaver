import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { SystemError } from "@effect/platform/Error";
import { Cause, Effect, Exit, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  FormatterExecutionError,
  FormatterFileSystemError,
  FormatterLoadError,
} from "../../src/services/errors/FormatterError.js";
import { Formatter, formatterLayerWith } from "../../src/services/Formatter.js";

const successfulFormatterModule = () =>
  Promise.resolve({
    format: (_filename: string, source: string) =>
      Promise.resolve({ code: source.replace("unformatted", "formatted") }),
  });

const provideFormatter = <A, E>(
  effect: Effect.Effect<A, E, Formatter>,
  formatterLayer: Layer.Layer<Formatter>
): Effect.Effect<A, E> => effect.pipe(Effect.provide(formatterLayer));

const formatterLayerAgainst = (
  fileSystemLayer: Layer.Layer<FileSystem.FileSystem>,
  loadModule: () => Promise<unknown> = successfulFormatterModule
): Layer.Layer<Formatter> =>
  formatterLayerWith(loadModule).pipe(Layer.provide(fileSystemLayer));

const expectTypedFailure = async <E>(
  effect: Effect.Effect<void, E>,
  expected: new (...args: never[]) => E
): Promise<E> => {
  const exit = await Effect.runPromiseExit(effect);
  expect(Exit.isFailure(exit)).toBe(true);
  if (!Exit.isFailure(exit)) {
    throw new Error("Expected Formatter effect to fail");
  }

  expect(Array.from(Cause.defects(exit.cause))).toHaveLength(0);
  const failures = Array.from(Cause.failures(exit.cause));
  expect(failures).toHaveLength(1);
  const failure = failures[0];
  if (failure === undefined) {
    throw new Error("Expected one typed Formatter failure");
  }
  expect(failure).toBeInstanceOf(expected);
  return failure;
};

describe("Formatter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-fmt-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("formats files through the platform FileSystem service", async () => {
    const filePath = path.join(tempDir, "sample.ts");
    fs.writeFileSync(filePath, "unformatted\n");
    const layer = formatterLayerAgainst(NodeContext.layer);

    await Effect.runPromise(provideFormatter(Formatter.format(tempDir), layer));

    expect(fs.readFileSync(filePath, "utf8")).toBe("formatted\n");
  });

  test("treats only an exact missing-oxfmt module error as a no-op", async () => {
    const missingModule = new Error(
      "Cannot find package 'oxfmt' imported from /typeweaver/Formatter.mjs"
    );
    Object.defineProperty(missingModule, "code", {
      value: "ERR_MODULE_NOT_FOUND",
    });
    const layer = formatterLayerAgainst(NodeContext.layer, () =>
      Promise.reject(missingModule)
    );

    const exit = await Effect.runPromiseExit(
      provideFormatter(Formatter.format("/path/that/must/not/be-read"), layer)
    );

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  test("surfaces a non-missing module-load failure precisely without defects", async () => {
    const bindingFailure = new Error("native oxfmt binding is incompatible");
    Object.defineProperty(bindingFailure, "code", {
      value: "ERR_DLOPEN_FAILED",
    });
    const layer = formatterLayerAgainst(NodeContext.layer, () =>
      Promise.reject(bindingFailure)
    );

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(tempDir), layer),
      FormatterLoadError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterLoadError",
      moduleName: "oxfmt",
      cause: bindingFailure,
    });
  });

  test("rejects an incompatible formatter module shape without defects", async () => {
    const layer = formatterLayerAgainst(NodeContext.layer, () =>
      Promise.resolve({ format: "not-a-function" })
    );

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(tempDir), layer),
      FormatterLoadError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterLoadError",
      moduleName: "oxfmt",
      cause: expect.objectContaining({
        message: "Module did not export a format function",
      }),
    });
  });

  test("surfaces a missing target directory as typed filesystem failure without defects", async () => {
    const missingPath = path.join(tempDir, "missing");
    const layer = formatterLayerAgainst(NodeContext.layer);

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(missingPath), layer),
      FormatterFileSystemError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterFileSystemError",
      operation: "realPath",
      path: missingPath,
      cause: {
        _tag: "SystemError",
        reason: "NotFound",
      },
    });
  });

  test("surfaces an injected permission error without defects", async () => {
    const permissionFailure = new SystemError({
      reason: "PermissionDenied",
      module: "FileSystem",
      method: "readDirectory",
      pathOrDescriptor: tempDir,
      description: "read access denied",
    });
    const fileSystemLayer = Layer.succeed(
      FileSystem.FileSystem,
      FileSystem.makeNoop({
        realPath: targetPath => Effect.succeed(targetPath),
        readDirectory: () => Effect.fail(permissionFailure),
      })
    );
    const layer = formatterLayerAgainst(fileSystemLayer);

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(tempDir), layer),
      FormatterFileSystemError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterFileSystemError",
      operation: "readDirectory",
      path: tempDir,
      cause: permissionFailure,
    });
  });

  test("surfaces a formatter rejection without defects", async () => {
    const filePath = path.join(tempDir, "broken.ts");
    fs.writeFileSync(filePath, "unformatted\n");
    const formatterFailure = new Error("formatter rejected source");
    const layer = formatterLayerAgainst(NodeContext.layer, () =>
      Promise.resolve({
        format: () => Promise.reject(formatterFailure),
      })
    );

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(tempDir), layer),
      FormatterExecutionError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterExecutionError",
      filePath,
      cause: formatterFailure,
    });
  });

  test("rejects an incompatible formatter result without defects", async () => {
    const filePath = path.join(tempDir, "invalid-result.ts");
    fs.writeFileSync(filePath, "unformatted\n");
    const layer = formatterLayerAgainst(NodeContext.layer, () =>
      Promise.resolve({
        format: () => Promise.resolve({ code: 42 }),
      })
    );

    const failure = await expectTypedFailure(
      provideFormatter(Formatter.format(tempDir), layer),
      FormatterExecutionError
    );

    expect(failure).toMatchObject({
      _tag: "FormatterExecutionError",
      filePath,
      cause: expect.objectContaining({
        message: "Formatter did not return a string code",
      }),
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe("unformatted\n");
  });
});
