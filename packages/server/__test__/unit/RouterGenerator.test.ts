import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  GeneratorContext,
  OperationResource,
} from "@rexeus/typeweaver-gen";
import { assert, describe, expect, test } from "vitest";
import { RouterGenerator } from "../../src/RouterGenerator";

// ---------------------------------------------------------------------------
// Helpers — we test the generator indirectly by capturing rendered output
// ---------------------------------------------------------------------------

function createMockResource(
  operationId: string,
  method: HttpMethod,
  path: string
): OperationResource {
  return {
    sourceDir: "/src",
    sourceFile: "/src/def.ts",
    sourceFileName: "def.ts",
    definition: {
      operationId,
      path,
      method,
      summary: "",
      request: {},
      responses: [],
    },
    outputDir: "/out/entity",
    entityName: "entity",
    outputRequestFile: "",
    outputRequestFileName: "",
    outputResponseFile: "",
    outputResponseFileName: "",
    outputRequestValidationFile: "",
    outputRequestValidationFileName: "",
    outputResponseValidationFile: "",
    outputResponseValidationFileName: "",
    outputClientFile: "",
    outputClientFileName: "",
  } as OperationResource;
}

function createMockContext(operations: OperationResource[]): {
  context: GeneratorContext;
  writtenFiles: Map<string, string>;
} {
  const writtenFiles = new Map<string, string>();
  const generatedFiles: string[] = [];

  const context = {
    outputDir: "/out",
    inputDir: "/in",
    config: {},
    resources: {
      entityResources: {
        entity: {
          operations,
          responses: [],
        },
      },
      sharedResponseResources: [],
    },
    templateDir: "/templates",
    coreDir: "/core",
    writeFile: (relativePath: string, content: string) => {
      writtenFiles.set(relativePath, content);
    },
    renderTemplate: (_templatePath: string, data: any) => {
      // Return operations in order so we can verify sorting
      return JSON.stringify(
        data.operations.map((op: any) => ({
          method: op.method,
          path: op.path,
          handlerName: op.handlerName,
          className: op.className,
        }))
      );
    },
    addGeneratedFile: (relativePath: string) => {
      generatedFiles.push(relativePath);
    },
    getGeneratedFiles: () => generatedFiles,
  } as unknown as GeneratorContext;

  return { context, writtenFiles };
}

function getOperationOrder(
  operations: OperationResource[]
): { method: string; path: string; handlerName: string; className: string }[] {
  const { context, writtenFiles } = createMockContext(operations);
  RouterGenerator.generate(context);

  const content = writtenFiles.values().next().value;
  assert(content, "Expected at least one written file");
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RouterGenerator", () => {
  describe("Route Sorting", () => {
    test("should sort shallow routes before deep routes", () => {
      const result = getOperationOrder([
        createMockResource("getSubItem", HttpMethod.GET, "/items/:id/sub"),
        createMockResource("getItems", HttpMethod.GET, "/items"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items");
      expect(result[1].path).toBe("/items/:id/sub");
    });

    test("should sort static segments before param segments at same depth", () => {
      const result = getOperationOrder([
        createMockResource("getItem", HttpMethod.GET, "/items/:id"),
        createMockResource("getSpecial", HttpMethod.GET, "/items/special"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items/special");
      expect(result[1].path).toBe("/items/:id");
    });

    test("should sort by method priority when paths are identical", () => {
      const result = getOperationOrder([
        createMockResource("deleteItem", HttpMethod.DELETE, "/items"),
        createMockResource("getItems", HttpMethod.GET, "/items"),
        createMockResource("createItem", HttpMethod.POST, "/items"),
        createMockResource("updateItem", HttpMethod.PUT, "/items"),
        createMockResource("patchItem", HttpMethod.PATCH, "/items"),
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
        createMockResource("getItems", HttpMethod.GET, "/items"),
        createMockResource("headItems", HttpMethod.HEAD, "/items"),
        createMockResource("createItem", HttpMethod.POST, "/items"),
      ]);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.method)).toEqual(["GET", "POST"]);
    });

    test("should sort alphabetically within same segment type", () => {
      const result = getOperationOrder([
        createMockResource("getUsers", HttpMethod.GET, "/users"),
        createMockResource("getTodos", HttpMethod.GET, "/todos"),
        createMockResource("getAccounts", HttpMethod.GET, "/accounts"),
      ]);

      expect(result.map(r => r.path)).toEqual([
        "/accounts",
        "/todos",
        "/users",
      ]);
    });

    test("should handle complex mixed routes", () => {
      const result = getOperationOrder([
        createMockResource(
          "deleteSubTodo",
          HttpMethod.DELETE,
          "/todos/:todoId/subtodos/:subtodoId"
        ),
        createMockResource("createTodo", HttpMethod.POST, "/todos"),
        createMockResource("listTodos", HttpMethod.GET, "/todos"),
        createMockResource("queryTodos", HttpMethod.POST, "/todos/query"),
        createMockResource("getTodo", HttpMethod.GET, "/todos/:todoId"),
        createMockResource(
          "listSubTodos",
          HttpMethod.GET,
          "/todos/:todoId/subtodos"
        ),
      ]);

      // Expected order:
      // 1. /todos (GET) - depth 1, method priority 1
      // 2. /todos (POST) - depth 1, method priority 2
      // 3. /todos/query (POST) - depth 2, static/static
      // 4. /todos/:todoId (GET) - depth 2, static/param
      // 5. /todos/:todoId/subtodos (GET) - depth 3
      // 6. /todos/:todoId/subtodos/:subtodoId (DELETE) - depth 4
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
        createMockResource("createTodo", HttpMethod.POST, "/todos"),
      ]);

      assert(result[0]);
      expect(result[0].className).toBe("CreateTodo");
      expect(result[0].handlerName).toBe("handleCreateTodoRequest");
    });

    test("should handle multi-word operationIds", () => {
      const result = getOperationOrder([
        createMockResource(
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
        createMockResource("getItems", HttpMethod.GET, "/items"),
      ];
      const { context, writtenFiles } = createMockContext(operations);

      RouterGenerator.generate(context);

      expect(writtenFiles.has("entity/EntityRouter.ts")).toBe(true);
    });
  });
});
