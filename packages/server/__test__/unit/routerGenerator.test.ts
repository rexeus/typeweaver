import path from "node:path";
import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  NormalizedOperation,
  NormalizedResource,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { assert, describe, expect, test } from "vitest";
import { generate } from "../../src/routerGenerator.js";
import type { RouterGenerationContext } from "../../src/routerGenerator.js";

type RouterOperationData = {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
  readonly handlerName: string;
  readonly className: string;
  readonly jsDoc?: string;
};

type RouterTemplateData = {
  readonly coreDir: string;
  readonly entityName: string;
  readonly pascalCaseEntityName: string;
  readonly operations: readonly RouterOperationData[];
};

function anOperation(
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

function aResource(
  name: string,
  operations: readonly NormalizedOperation[]
): NormalizedResource {
  return {
    name,
    operations,
  };
}

function aCapturingGeneratorContext(resources: readonly NormalizedResource[]): {
  context: RouterGenerationContext;
  writtenFiles: Map<string, string>;
  renderedRouters: Map<string, RouterTemplateData>;
} {
  const writtenFiles = new Map<string, string>();
  const renderedRouters = new Map<string, RouterTemplateData>();
  const normalizedSpec: NormalizedSpec = {
    resources,
    responses: [],
    warnings: [],
  };

  const context = {
    outputDir: "/out",
    normalizedSpec,
    getResourceOutputDir: (resourceName: string) =>
      path.join("/out", resourceName),
    writeFile: (relativePath: string, content: string) => {
      writtenFiles.set(relativePath, content);
    },
    renderTemplate: (_templatePath: string, data: unknown) => {
      const routerData = data as RouterTemplateData;
      renderedRouters.set(routerData.entityName, routerData);

      return JSON.stringify(routerData);
    },
  } satisfies RouterGenerationContext;

  return { context, writtenFiles, renderedRouters };
}

function getRenderedRouter(
  renderedRouters: Map<string, RouterTemplateData>,
  entityName: string
): RouterTemplateData {
  const routerData = renderedRouters.get(entityName);
  assert(routerData, `Expected ${entityName} router data to be rendered`);

  return routerData;
}

function getOperationOrder(
  operations: readonly NormalizedOperation[]
): readonly RouterOperationData[] {
  const { context, renderedRouters } = aCapturingGeneratorContext([
    aResource("entity", operations),
  ]);

  generate(context);

  return getRenderedRouter(renderedRouters, "entity").operations;
}

describe("RouterGenerator", () => {
  describe("Route Sorting", () => {
    test("sorts shallow routes before deep routes", () => {
      const result = getOperationOrder([
        anOperation("getSubItem", HttpMethod.GET, "/items/:id/sub"),
        anOperation("getItems", HttpMethod.GET, "/items"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items");
      expect(result[1].path).toBe("/items/:id/sub");
    });

    test("sorts static segments before param segments at the same depth", () => {
      const result = getOperationOrder([
        anOperation("getItem", HttpMethod.GET, "/items/:id"),
        anOperation("getSpecial", HttpMethod.GET, "/items/special"),
      ]);

      assert(result[0]);
      assert(result[1]);
      expect(result[0].path).toBe("/items/special");
      expect(result[1].path).toBe("/items/:id");
    });

    test("sorts by method priority when paths are identical", () => {
      const result = getOperationOrder([
        anOperation("deleteItem", HttpMethod.DELETE, "/items"),
        anOperation("getItems", HttpMethod.GET, "/items"),
        anOperation("createItem", HttpMethod.POST, "/items"),
        anOperation("updateItem", HttpMethod.PUT, "/items"),
        anOperation("patchItem", HttpMethod.PATCH, "/items"),
      ]);

      expect(result.map(r => r.method)).toEqual([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
      ]);
    });

    test("keeps OPTIONS operations while filtering HEAD operations", () => {
      const result = getOperationOrder([
        anOperation("getItems", HttpMethod.GET, "/items"),
        anOperation("headItems", HttpMethod.HEAD, "/items"),
        anOperation("createItem", HttpMethod.POST, "/items"),
        anOperation("optionsItems", HttpMethod.OPTIONS, "/items"),
      ]);

      expect(result.map(r => r.method)).toEqual(["GET", "POST", "OPTIONS"]);
    });

    test("sorts alphabetically within the same segment type", () => {
      const result = getOperationOrder([
        anOperation("getUsers", HttpMethod.GET, "/users"),
        anOperation("getTodos", HttpMethod.GET, "/todos"),
        anOperation("getAccounts", HttpMethod.GET, "/accounts"),
      ]);

      expect(result.map(r => r.path)).toEqual([
        "/accounts",
        "/todos",
        "/users",
      ]);
    });

    test("sorts complex mixed routes by path shape and method priority", () => {
      const result = getOperationOrder([
        anOperation(
          "deleteSubTodo",
          HttpMethod.DELETE,
          "/todos/:todoId/subtodos/:subtodoId"
        ),
        anOperation("createTodo", HttpMethod.POST, "/todos"),
        anOperation("listTodos", HttpMethod.GET, "/todos"),
        anOperation("queryTodos", HttpMethod.POST, "/todos/query"),
        anOperation("getTodo", HttpMethod.GET, "/todos/:todoId"),
        anOperation("listSubTodos", HttpMethod.GET, "/todos/:todoId/subtodos"),
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
    test("generates class and handler names from operation ids", () => {
      const result = getOperationOrder([
        anOperation("createTodo", HttpMethod.POST, "/todos"),
      ]);

      assert(result[0]);
      expect(result[0].className).toBe("CreateTodo");
      expect(result[0].handlerName).toBe("handleCreateTodoRequest");
    });

    test("generates class and handler names from multi-word operation ids", () => {
      const result = getOperationOrder([
        anOperation("updateTodoStatus", HttpMethod.PUT, "/todos/:id/status"),
      ]);

      assert(result[0]);
      expect(result[0].className).toBe("UpdateTodoStatus");
      expect(result[0].handlerName).toBe("handleUpdateTodoStatusRequest");
    });

    test("emits sanitized operation summaries as handler JSDoc", () => {
      const result = getOperationOrder([
        {
          ...anOperation("createTodo", HttpMethod.POST, "/todos"),
          summary: "Create todo */ safely",
        },
      ]);

      assert(result[0]);
      expect(result[0].jsDoc).toBe(
        "  /**\n   * Create todo *\\/ safely\n   */"
      );
    });

    test("preserves method path and operation id associations after sorting", () => {
      const result = getOperationOrder([
        anOperation("createTodo", HttpMethod.POST, "/todos"),
        anOperation("listAccounts", HttpMethod.GET, "/accounts"),
        anOperation("deleteTodo", HttpMethod.DELETE, "/todos/:id"),
      ]);

      expect(result).toEqual([
        {
          operationId: "listAccounts",
          method: "GET",
          path: "/accounts",
          handlerName: "handleListAccountsRequest",
          className: "ListAccounts",
        },
        {
          operationId: "createTodo",
          method: "POST",
          path: "/todos",
          handlerName: "handleCreateTodoRequest",
          className: "CreateTodo",
        },
        {
          operationId: "deleteTodo",
          method: "DELETE",
          path: "/todos/:id",
          handlerName: "handleDeleteTodoRequest",
          className: "DeleteTodo",
        },
      ]);
    });
  });

  describe("File Output", () => {
    test("writes a router file with the expected resource path", () => {
      const operations = [anOperation("getItems", HttpMethod.GET, "/items")];
      const { context, writtenFiles } = aCapturingGeneratorContext([
        aResource("entity", operations),
      ]);

      generate(context);

      expect(writtenFiles.has("entity/EntityRouter.ts")).toBe(true);
    });

    test("writes one router file per resource", () => {
      const { context, writtenFiles } = aCapturingGeneratorContext([
        aResource("accounts", [
          anOperation("listAccounts", HttpMethod.GET, "/accounts"),
        ]),
        aResource("todos", [
          anOperation("listTodos", HttpMethod.GET, "/todos"),
        ]),
      ]);

      generate(context);

      expect([...writtenFiles.keys()].sort()).toEqual([
        "accounts/AccountsRouter.ts",
        "todos/TodosRouter.ts",
      ]);
    });

    test("writes router files using PascalCase resource names", () => {
      const { context, writtenFiles } = aCapturingGeneratorContext([
        aResource("todoItem", [
          anOperation("listTodoItems", HttpMethod.GET, "/todo-items"),
        ]),
      ]);

      generate(context);

      expect(writtenFiles.has("todoItem/TodoItemRouter.ts")).toBe(true);
    });

    test("passes resource casing to the router template", () => {
      const { context, renderedRouters } = aCapturingGeneratorContext([
        aResource("todoItem", [
          anOperation("listTodoItems", HttpMethod.GET, "/todo-items"),
        ]),
      ]);

      generate(context);

      const routerData = getRenderedRouter(renderedRouters, "todoItem");

      expect(routerData.entityName).toBe("todoItem");
      expect(routerData.pascalCaseEntityName).toBe("TodoItem");
    });

    test("writes an empty router for a resource without operations", () => {
      const { context, renderedRouters, writtenFiles } =
        aCapturingGeneratorContext([aResource("empty", [])]);

      generate(context);
      const routerData = getRenderedRouter(renderedRouters, "empty");

      expect(writtenFiles.has("empty/EmptyRouter.ts")).toBe(true);
      expect(routerData.operations).toEqual([]);
    });

    test("writes empty router operations for a resource with only HEAD operations", () => {
      const { context, renderedRouters } = aCapturingGeneratorContext([
        aResource("items", [
          anOperation("headItems", HttpMethod.HEAD, "/items"),
        ]),
      ]);

      generate(context);

      const routerData = getRenderedRouter(renderedRouters, "items");

      expect(routerData.operations).toEqual([]);
    });

    test("generates no files when there are no resources", () => {
      const { context, writtenFiles } = aCapturingGeneratorContext([]);

      generate(context);

      expect([...writtenFiles.keys()]).toEqual([]);
    });

    test("passes the relative core import path to the router template", () => {
      const { context, renderedRouters } = aCapturingGeneratorContext([
        aResource("entity", [
          anOperation("listItems", HttpMethod.GET, "/items"),
        ]),
      ]);

      generate(context);
      const routerData = getRenderedRouter(renderedRouters, "entity");

      expect(routerData.coreDir).toBe("..");
    });

    test("passes sorted operations to the router template", () => {
      const { context, renderedRouters } = aCapturingGeneratorContext([
        aResource("entity", [
          anOperation("deleteItem", HttpMethod.DELETE, "/items/:id"),
          anOperation("listItems", HttpMethod.GET, "/items"),
        ]),
      ]);

      generate(context);
      const routerData = getRenderedRouter(renderedRouters, "entity");

      expect(
        routerData.operations.map(operation => operation.operationId)
      ).toEqual(["listItems", "deleteItem"]);
    });
  });
});
