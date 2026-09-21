import fs from "node:fs";
import path from "node:path";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { Cause, Effect, Result, Exit, Layer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { SpecBundleOutputMissingError } from "../src/services/errors/specErrors.js";
import { isSpecDefinition } from "../src/services/internal/specGuards.js";
import {
  createWrapperImportSpecifier,
  SpecBundler,
} from "../src/services/SpecBundler.js";
import type {
  SpecBundlerConfig,
  SpecBundlerDeps,
} from "../src/services/SpecBundler.js";

const causeDefects = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

const causeFailures = (cause: Cause.Cause<unknown>): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isFailReason).map(reason => reason.error);

// Test shims that bridge the legacy sync/async API onto the new services.
// `Effect.result` flattens typed failures into the success channel so
// tests can `.rejects.toBeInstanceOf` against the underlying error rather
// than against Effect's `FiberFailure` wrapper.
const SpecBundlerLayer = SpecBundler.Default.pipe(
  Layer.provide(nodeFileSystemLayer)
);

const bundle = async (
  config: SpecBundlerConfig,
  deps?: SpecBundlerDeps
): Promise<string> => {
  const result = await Effect.runPromise(
    Effect.result(SpecBundler.bundle(config, deps)).pipe(
      Effect.provide(SpecBundlerLayer)
    )
  );
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

type TempProject = {
  readonly projectDir: string;
  readonly outputDir: string;
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
});

const createTempProject = (): TempProject => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), ".typeweaver-spec-loader-")
  );
  const projectDir = path.join(tempDir, "project with spaces");

  fs.mkdirSync(projectDir, { recursive: true });
  tempDirs.push(tempDir);

  return {
    projectDir,
    outputDir: path.join(projectDir, "generated spec"),
  };
};

const writeProjectFile = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  const filePath = path.join(project.projectDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trim()}\n`);

  return filePath;
};

const writeSpecEntrypoint = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  return writeProjectFile(project, relativePath, contents);
};

const validSpecDefinition = {
  metadata: { title: "Todo API", version: "1.0.0" },
  resources: {
    todos: {
      operations: [
        {
          operationId: "listTodos",
          method: "GET",
          path: "/todos",
          summary: "List todos",
          request: {},
          responses: [
            {
              name: "TodoResponse",
              statusCode: HttpStatusCode.OK,
              description: "Todo response",
            },
          ],
        },
      ],
    },
  },
};

const [validOperation] = validSpecDefinition.resources.todos.operations;

if (validOperation === undefined) {
  throw new Error("Expected the valid spec fixture to contain an operation");
}

const invalidSpecDefinitions = [
  { scenario: "null spec", value: null },
  { scenario: "non-object spec", value: "not a spec" },
  {
    scenario: "missing metadata",
    value: { resources: validSpecDefinition.resources },
  },
  { scenario: "non-object resources", value: { resources: [1, 2] } },
  {
    scenario: "resource without operations array",
    value: { resources: { todos: {} } },
  },
  {
    scenario: "operation missing summary",
    value: {
      resources: {
        todos: {
          operations: [
            {
              operationId: "listTodos",
              method: "GET",
              path: "/todos",
              request: {},
              responses: validOperation.responses,
            },
          ],
        },
      },
    },
  },
  {
    scenario: "operation with undefined request",
    value: {
      resources: {
        todos: {
          operations: [
            {
              ...validSpecDefinition.resources.todos.operations[0],
              request: undefined,
            },
          ],
        },
      },
    },
  },
  {
    scenario: "invalid HTTP method",
    value: {
      resources: {
        todos: {
          operations: [
            {
              ...validSpecDefinition.resources.todos.operations[0],
              method: "FETCH",
            },
          ],
        },
      },
    },
  },
  {
    scenario: "empty responses array",
    value: {
      resources: {
        todos: {
          operations: [
            {
              ...validSpecDefinition.resources.todos.operations[0],
              responses: [],
            },
          ],
        },
      },
    },
  },
  {
    scenario: "response missing status code",
    value: {
      resources: {
        todos: {
          operations: [
            {
              ...validSpecDefinition.resources.todos.operations[0],
              responses: [
                {
                  name: "TodoResponse",
                  description: "Todo response",
                },
              ],
            },
          ],
        },
      },
    },
  },
  {
    scenario: "response with unregistered status code",
    value: {
      resources: {
        todos: {
          operations: [
            {
              ...validSpecDefinition.resources.todos.operations[0],
              responses: [
                {
                  name: "TodoResponse",
                  statusCode: 299,
                  description: "Todo response",
                },
              ],
            },
          ],
        },
      },
    },
  },
] as const;

describe("SpecLoader structural guards", () => {
  test("accepts a structurally valid spec definition", () => {
    expect(isSpecDefinition(validSpecDefinition)).toBe(true);
  });

  test.each(invalidSpecDefinitions)("rejects $scenario", ({ value }) => {
    expect(isSpecDefinition(value)).toBe(false);
  });
});

describe("SpecLoader wrapper import specifiers", () => {
  test("creates a relative wrapper import specifier for posix paths", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec-entrypoint.ts",
        "/tmp/typeweaver/spec.ts"
      )
    ).toBe("./spec.ts");
  });

  test("creates a relative wrapper import specifier for windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "C:\\project\\.typeweaver\\spec-entrypoint.ts",
        "C:\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("creates a relative wrapper import specifier for UNC windows paths", () => {
    expect(
      createWrapperImportSpecifier(
        "\\\\server\\share\\project\\.typeweaver\\spec-entrypoint.ts",
        "\\\\server\\share\\project\\specs\\spec.ts"
      )
    ).toBe("../specs/spec.ts");
  });

  test("preserves spaces in wrapper import specifiers", () => {
    expect(
      createWrapperImportSpecifier(
        "/tmp/typeweaver/spec loader/spec-entrypoint.ts",
        "/tmp/typeweaver/spec source/spec.ts"
      )
    ).toBe("../spec source/spec.ts");
  });
});

describe("SpecLoader bundler output contract", () => {
  test.skipIf(process.platform === "win32")(
    "reports input disappearance between exists and realpath as a typed bundle failure",
    async () => {
      // Native Windows and UNC inputs intentionally use lexical win32 path
      // semantics and never enter the POSIX realpath branch exercised here.
      const project = createTempProject();
      const inputFile = writeSpecEntrypoint(
        project,
        "spec.ts",
        "export const spec = { resources: {} };"
      );
      const probeFailure = Object.assign(
        new Error("input disappeared before realpath"),
        {
          code: "ENOENT",
        }
      );
      const realpathSync = fs.realpathSync.native;
      let buildStarted = false;

      const exit = await Effect.runPromiseExit(
        SpecBundler.bundle(
          {
            inputFile,
            specOutputDir: project.outputDir,
          },
          {
            build: async () => {
              buildStarted = true;
            },
            realpathSync: filePath => {
              if (filePath === inputFile) {
                throw probeFailure;
              }
              return realpathSync(filePath);
            },
          }
        ).pipe(Effect.provide(SpecBundlerLayer))
      );

      expect(buildStarted).toBe(false);
      expect(Exit.isFailure(exit)).toBe(true);
      if (!Exit.isFailure(exit)) return;
      expect(Array.from(causeDefects(exit.cause))).toEqual([]);
      expect(Array.from(causeFailures(exit.cause))).toEqual([
        expect.objectContaining({
          inputFile,
          cause: probeFailure,
          _tag: "SpecBundleError",
        }) as unknown,
      ]);
      expect(fs.readdirSync(project.outputDir)).toEqual([]);
    }
  );
  test("rejects successful spec builds that do not create the bundled output", async () => {
    const project = createTempProject();
    const inputFile = path.join(project.projectDir, "spec.ts");

    const bundling = bundle(
      {
        inputFile,
        specOutputDir: project.outputDir,
      },
      {
        build: async () => undefined,
        existsSync: () => false,
      }
    );

    await expect(bundling).rejects.toBeInstanceOf(SpecBundleOutputMissingError);
    await expect(bundling).rejects.toMatchObject({
      inputFile,
      bundledSpecFile: path.join(project.outputDir, "spec.js"),
      specOutputDir: project.outputDir,
    });
  });
});
