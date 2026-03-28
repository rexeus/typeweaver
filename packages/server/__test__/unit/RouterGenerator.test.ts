import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { assert, describe, expect, test } from "vitest";
import { RouterGenerator } from "../../src/RouterGenerator";

function createMockOperation(
  operationId: string,
  method: HttpMethod,
  routePath: string
): NormalizedOperation {
  return {
    operationId,
    path: routePath,
    method,
    summary: "",
    request: undefined,
    responses: [],
  };
}

function createMockContext(operations: NormalizedOperation[]): {
  context: GeneratorContext;
  writtenFiles: Map<string, string>;
} {
  const writtenFiles = new Map<string, string>();
  const generatedFiles: string[] = [];
  const normalizedSpec: NormalizedSpec = {
    resources: [
      {
        name: "entity",
        operations,
      },
    ],
    responses: [],
  };

  const context = {
    outputDir: "/out",
    inputDir: "/in",
    config: {},
    normalizedSpec,
    templateDir: "/templates",
    coreDir: "/core",
    responsesOutputDir: "/out/responses",
    specOutputDir: "/out/spec",
    getCanonicalResponse: () => {
      throw new Error("not implemented");
    },
    getCanonicalResponseOutputFile: (responseName: string) => {
      return `/out/responses/${responseName}Response.ts`;
    },
    getCanonicalResponseImportPath: () => {
      throw new Error("not implemented");
    },
    getOperationDefinitionImportPath: () => {
      throw new Error("not implemented");
    },
    getOperationOutputPaths: ({
      operationId,
      resourceName,
    }: {
      readonly operationId: string;
      readonly resourceName: string;
    }) => {
      const outputDir = path.join("/out", resourceName);

      return {
        outputDir,
        requestFile: path.join(outputDir, `${operationId}Request.ts`),
        requestFileName: `${operationId}Request.ts`,
        responseFile: path.join(outputDir, `${operationId}Response.ts`),
        responseFileName: `${operationId}Response.ts`,
        requestValidationFile: path.join(
          outputDir,
          `${operationId}RequestValidator.ts`
        ),
        requestValidationFileName: `${operationId}RequestValidator.ts`,
        responseValidationFile: path.join(
          outputDir,
          `${operationId}ResponseValidator.ts`
        ),
        responseValidationFileName: `${operationId}ResponseValidator.ts`,
        clientFile: path.join(outputDir, `${operationId}Client.ts`),
        clientFileName: `${operationId}Client.ts`,
      };
    },
    getResourceOutputDir: (resourceName: string) =>
      path.join("/out", resourceName),
    writeFile: (relativePath: string, content: string) => {
      writtenFiles.set(relativePath, content);
    },
    renderTemplate: (_templatePath: string, data: any) => {
      return JSON.stringify(
        data.operations.map((operation: any) => ({
          operationId: operation.operationId,
          method: operation.method,
          path: operation.path,
          handlerName: operation.handlerName,
          className: operation.className,
        }))
      );
    },
    addGeneratedFile: (relativePath: string) => {
      generatedFiles.push(relativePath);
    },
    getGeneratedFiles: () => generatedFiles,
  } satisfies GeneratorContext;

  return { context, writtenFiles };
}

function getOperationOrder(operations: NormalizedOperation[]): {
  operationId: string;
  method: string;
  path: string;
  handlerName: string;
  className: string;
}[] {
  const { context, writtenFiles } = createMockContext(operations);
  RouterGenerator.generate(context);

  const content = writtenFiles.values().next().value;
  assert(content, "Expected at least one written file");
  return JSON.parse(content);
}

describe("RouterGenerator", () => {
  describe("Route Sorting", () => {
    test("should sort shallow routes before deep routes", () => {
      const result = getOperationOrder([
        createMockOperation("getSubItem", HttpMethod.GET, "/items/:id/sub"),
        createMockOperation("getItems", HttpMethod.GET, "/items"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items");
      expect(result[1].path).toBe("/items/:id/sub");
    });

    test("should sort static segments before param segments at same depth", () => {
      const result = getOperationOrder([
        createMockOperation("getItem", HttpMethod.GET, "/items/:id"),
        createMockOperation("getSpecial", HttpMethod.GET, "/items/special"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items/special");
      expect(result[1].path).toBe("/items/:id");
    });

    test("should sort by method priority when paths are identical", () => {
      const result = getOperationOrder([
        createMockOperation("deleteItem", HttpMethod.DELETE, "/items"),
        createMockOperation("getItems", HttpMethod.GET, "/items"),
        createMockOperation("createItem", HttpMethod.POST, "/items"),
        createMockOperation("updateItem", HttpMethod.PUT, "/items"),
        createMockOperation("patchItem", HttpMethod.PATCH, "/items"),
      ]);

      expect(result.map(r => r.method)).toEqual([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ]);
    });

    test("should filter out HEAD operations", () => {
      const result = getOperationOrder([
        createMockOperation("getItems", HttpMethod.GET, "/items"),
        createMockOperation("headItems", HttpMethod.HEAD, "/items"),
        createMockOperation("createItem", HttpMethod.POST, "/items"),
      ]);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.method)).toEqual(["GET", "POST"]);
    });

    test("should sort alphabetically within same segment type", () => {
      const result = getOperationOrder([
        createMockOperation("getUsers", HttpMethod.GET, "/users"),
        createMockOperation("getTodos", HttpMethod.GET, "/todos"),
        createMockOperation("getAccounts", HttpMethod.GET, "/accounts"),
      ]);

      expect(result.map(r => r.path)).toEqual([
        "/accounts",
        "/todos",
        "/users",
      ]);
    });

    test("should handle complex mixed routes", () => {
      const result = getOperationOrder([
        createMockOperation(
          "deleteSubTodo",
          HttpMethod.DELETE,
          "/todos/:todoId/subtodos/:subtodoId"
        ),
        createMockOperation("createTodo", HttpMethod.POST, "/todos"),
        createMockOperation("listTodos", HttpMethod.GET, "/todos"),
        createMockOperation("queryTodos", HttpMethod.POST, "/todos/query"),
        createMockOperation("getTodo", HttpMethod.GET, "/todos/:todoId"),
        createMockOperation(
          "listSubTodos",
          HttpMethod.GET,
          "/todos/:todoId/subtodos"
        ),
      ]);

      expect(result.map(r => `${r.method} ${r.path}`)).toEqual([
        "GET /todos",
        "POST /todos",
        "POST /todos/query",
        "GET /todos/:todoId",
        "GET /todos/:todoId/subtodos",
        "DELETE /todos/:todoId/subtodos/:subtodoId",
      ]);
    });
  });

  describe("Operation Data Generation", () => {
    test("should generate correct className and handlerName from operationId", () => {
      const result = getOperationOrder([
        createMockOperation("createTodo", HttpMethod.POST, "/todos"),
      ]);

      assert(result[0]);
      expect(result[0].className).toBe("CreateTodo");
      expect(result[0].handlerName).toBe("handleCreateTodoRequest");
    });

    test("should handle multi-word operationIds", () => {
      const result = getOperationOrder([
        createMockOperation(
          "updateTodoStatus",
          HttpMethod.PUT,
          "/todos/:id/status"
        ),
      ]);

      assert(result[0]);
      expect(result[0].className).toBe("UpdateTodoStatus");
      expect(result[0].handlerName).toBe("handleUpdateTodoStatusRequest");
    });
  });

  describe("File Output", () => {
    test("should write output file with correct path", () => {
      const operations = [
        createMockOperation("getItems", HttpMethod.GET, "/items"),
      ];
      const { context, writtenFiles } = createMockContext(operations);

      RouterGenerator.generate(context);

      expect(writtenFiles.has("entity/EntityRouter.ts")).toBe(true);
    });
  });
});
