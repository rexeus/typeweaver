import fs from "node:fs";
import path from "node:path";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { Effect, Result, Layer } from "effect";
import { SpecLoader } from "../src/services/SpecLoader.js";
import type {
  LoadedSpec,
  SpecLoaderConfig,
} from "../src/services/SpecLoader.js";

export const SpecLoaderLayer = SpecLoader.Default.pipe(
  Layer.provide(nodeFileSystemLayer)
);

export const loadSpec = async (
  config: SpecLoaderConfig
): Promise<LoadedSpec> => {
  const result = await Effect.runPromise(
    Effect.result(SpecLoader.load(config)).pipe(Effect.provide(SpecLoaderLayer))
  );
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

export const SPEC_DECLARATION = [
  'import type { SpecDefinition } from "@rexeus/typeweaver-core";',
  "export declare const spec: SpecDefinition;",
  "",
].join("\n");

export type TempProject = {
  readonly projectDir: string;
  readonly outputDir: string;
};

export type TodoSpecExportStyle = "named" | "default";

export const tempDirs: string[] = [];

export const createTempProject = (): TempProject => {
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

export const writeProjectFile = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  const filePath = path.join(project.projectDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trim()}\n`);

  return filePath;
};

export const writeSpecEntrypoint = (
  project: TempProject,
  relativePath: string,
  contents: string
): string => {
  return writeProjectFile(project, relativePath, contents);
};

export const loadProjectSpec = async (
  project: TempProject,
  inputFile: string
): Promise<LoadedSpec> => {
  return loadSpec({
    inputFile: path.relative(process.cwd(), inputFile),
    specOutputDir: project.outputDir,
  });
};

export const writeTodoResponseModule = (
  project: TempProject,
  options: { readonly fileName: string }
): string => {
  return writeProjectFile(
    project,
    options.fileName,
    `
        import { defineResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
        import { z } from "zod";

        export const todoResponse = defineResponse({
          name: "TodoResponse",
          statusCode: HttpStatusCode.OK,
          description: "Todo loaded",
          body: z.object({ id: z.string() }),
        });
      `
  );
};

export const writeTodoSpecEntrypoint = (
  project: TempProject,
  options: {
    readonly fileName: string;
    readonly exportStyle: TodoSpecExportStyle;
    readonly responseImport: string;
    readonly includeNotFoundResponse?: boolean;
  }
): string => {
  const specExport =
    options.exportStyle === "default"
      ? "export default defineSpec"
      : "export const spec = defineSpec";
  const coreImports = options.includeNotFoundResponse
    ? "defineOperation, defineSpec, HttpMethod, HttpStatusCode"
    : "defineOperation, defineSpec, HttpMethod";
  const operationResponses = options.includeNotFoundResponse
    ? `
                    todoResponse,
                    {
                      name: "TodoNotFound",
                      statusCode: HttpStatusCode.NOT_FOUND,
                      description: "Todo not found",
                      body: z.object({ message: z.string() }),
                    },
                  `
    : "todoResponse";

  return writeSpecEntrypoint(
    project,
    options.fileName,
    `
        import { ${coreImports} } from "@rexeus/typeweaver-core";
        import { z } from "zod";
        import { todoResponse } from ${JSON.stringify(options.responseImport)};

        ${specExport}({
          metadata: { title: "Todo API", version: "1.0.0" },
          resources: {
            todos: {
              operations: [
                defineOperation({
                  operationId: "getTodo",
                  method: HttpMethod.GET,
                  path: "/todos/:todoId",
                  summary: "Get todo",
                  request: {
                    param: z.object({ todoId: z.string() }),
                  },
                  responses: [${operationResponses}],
                }),
              ],
            },
          },
        });
      `
  );
};

export const writeTodoResourcesEntrypoint = (
  project: TempProject,
  options: { readonly fileName: string }
): string => {
  return writeSpecEntrypoint(
    project,
    options.fileName,
    `
        import { defineOperation, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
        import { z } from "zod";

        export const metadata = { title: "Todo API", version: "1.0.0" };
        export const resources = {
          todos: {
            operations: [
              defineOperation({
                operationId: "getTodo",
                method: HttpMethod.GET,
                path: "/todos/:todoId",
                summary: "Get todo",
                request: {
                  param: z.object({ todoId: z.string() }),
                },
                responses: [
                  {
                    name: "TodoResponse",
                    statusCode: HttpStatusCode.OK,
                    description: "Todo loaded",
                    body: z.object({ id: z.string() }),
                  },
                ],
              }),
            ],
          },
        };
      `
  );
};

export const writeTodoSpecWithOperation = (
  project: TempProject,
  options: {
    readonly fileName: string;
    readonly operationId: string;
    readonly summary: string;
  }
): string => {
  return writeSpecEntrypoint(
    project,
    options.fileName,
    `
        export const spec = {
          metadata: { title: "Todo API", version: "1.0.0" },
          resources: {
            todos: {
              operations: [
                {
                  operationId: ${JSON.stringify(options.operationId)},
                  method: "GET",
                  path: "/todos",
                  summary: ${JSON.stringify(options.summary)},
                  request: {},
                  responses: [
                    {
                      name: "TodoResponse",
                      statusCode: 200,
                      description: "Todo response",
                    },
                  ],
                },
              ],
            },
          },
        };
      `
  );
};

export const cleanupSpecLoaderProjects = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
};
