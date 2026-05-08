import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  getOperationDefinition,
  getResponseDefinition,
} from "../../src/lib/definitionLookup.js";
import { MissingOperationDefinitionError } from "../../src/lib/errors/MissingOperationDefinitionError.js";
import { MissingResponseDefinitionError } from "../../src/lib/errors/MissingResponseDefinitionError.js";

const createTodoSuccess = defineResponse({
  name: "CreateTodoSuccess",
  statusCode: HttpStatusCode.CREATED,
  description: "Todo created",
  body: z.object({ id: z.string() }),
});

const getTodoSuccess = defineResponse({
  name: "GetTodoSuccess",
  statusCode: HttpStatusCode.OK,
  description: "Todo found",
  body: z.object({ id: z.string() }),
});

const createProjectSuccess = defineResponse({
  name: "CreateProjectSuccess",
  statusCode: HttpStatusCode.CREATED,
  description: "Project created",
  body: z.object({ id: z.string() }),
});

const notFoundError = defineResponse({
  name: "NotFoundError",
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "Not found",
  body: z.object({ message: z.string() }),
});

const createTodo = defineOperation({
  operationId: "create",
  method: HttpMethod.POST,
  path: "/todos",
  summary: "Create todo",
  request: {},
  responses: [createTodoSuccess, notFoundError] as const,
});

const getTodo = defineOperation({
  operationId: "get",
  method: HttpMethod.GET,
  path: "/todos/:todoId",
  summary: "Get todo",
  request: {
    param: z.object({ todoId: z.string() }),
  },
  responses: [getTodoSuccess, notFoundError] as const,
});

const createProject = defineOperation({
  operationId: "createProject",
  method: HttpMethod.POST,
  path: "/projects",
  summary: "Create project",
  request: {},
  responses: [createProjectSuccess] as const,
});

const archiveProject = defineOperation({
  operationId: "archive",
  method: HttpMethod.POST,
  path: "/projects/:projectId/archive",
  summary: "Archive project",
  request: {
    param: z.object({ projectId: z.string() }),
  },
  responses: [createProjectSuccess] as const,
});

const todoAndProjectSpec = defineSpec({
  resources: {
    todo: {
      operations: [createTodo, getTodo] as const,
    },
    project: {
      operations: [createProject, archiveProject] as const,
    },
  },
});

const captureMissingOperationDefinitionError = (
  action: () => void
): MissingOperationDefinitionError => {
  const error = captureError(action);

  if (!(error instanceof MissingOperationDefinitionError)) {
    throw new TestAssertionError(
      "Expected MissingOperationDefinitionError to be thrown"
    );
  }

  return error;
};

const captureMissingResponseDefinitionError = (
  action: () => void
): MissingResponseDefinitionError => {
  const error = captureError(action);

  if (!(error instanceof MissingResponseDefinitionError)) {
    throw new TestAssertionError(
      "Expected MissingResponseDefinitionError to be thrown"
    );
  }

  return error;
};

describe("definitionLookup", () => {
  describe("getOperationDefinition", () => {
    test("returns the matching operation from the requested resource", () => {
      const operation = getOperationDefinition(
        todoAndProjectSpec,
        "todo",
        "get"
      );

      expect(operation).toBe(getTodo);
    });

    test("returns the operation object from a different requested resource", () => {
      const operation = getOperationDefinition(
        todoAndProjectSpec,
        "project",
        "createProject"
      );

      expect(operation).toBe(createProject);
    });

    test("preserves the exact operation object from the operation array", () => {
      const spec = defineSpec({
        resources: {
          ordered: {
            operations: [createTodo, getTodo] as const,
          },
        },
      });

      const operation = getOperationDefinition(spec, "ordered", "get");

      expect(operation).toBe(getTodo);
    });

    test("reports the requested resource and operation when the resource is missing", () => {
      const spec = todoAndProjectSpec as unknown as SpecDefinition;

      const error = captureMissingOperationDefinitionError(() =>
        getOperationDefinition(spec, "archive", "create")
      );

      expect(error).toEqual(
        expect.objectContaining({
          resourceName: "archive",
          operationId: "create",
        })
      );
    });

    test("reports the requested resource and operation when the operation is missing", () => {
      const error = captureMissingOperationDefinitionError(() =>
        getOperationDefinition(todoAndProjectSpec, "todo", "delete")
      );

      expect(error).toEqual(
        expect.objectContaining({
          resourceName: "todo",
          operationId: "delete",
        })
      );
    });

    test("reports the requested resource when another resource has the operation", () => {
      const error = captureMissingOperationDefinitionError(() =>
        getOperationDefinition(todoAndProjectSpec, "todo", "archive")
      );

      expect(error).toEqual(
        expect.objectContaining({
          resourceName: "todo",
          operationId: "archive",
        })
      );
    });
  });

  describe("getResponseDefinition", () => {
    test("returns the matching response from a response array", () => {
      const responses = [createTodoSuccess, notFoundError] as const;

      const response = getResponseDefinition(responses, "NotFoundError");

      expect(response).toBe(notFoundError);
    });

    test("preserves the first matching response object in array order", () => {
      const firstConflict = defineResponse({
        name: "ConflictError",
        statusCode: HttpStatusCode.CONFLICT,
        description: "First conflict",
      });
      const secondConflict = defineResponse({
        name: "ConflictError",
        statusCode: HttpStatusCode.CONFLICT,
        description: "Second conflict",
      });
      const responses = [firstConflict, secondConflict] as const;

      const response = getResponseDefinition(responses, "ConflictError");

      expect(response).toBe(firstConflict);
    });

    test("reports the requested response when no response matches", () => {
      const responses = [createTodoSuccess, notFoundError] as const;

      const error = captureMissingResponseDefinitionError(() =>
        getResponseDefinition(responses, "ValidationError")
      );

      expect(error).toEqual(
        expect.objectContaining({
          responseName: "ValidationError",
        })
      );
    });

    test("matches response names with exact casing", () => {
      const responses = [notFoundError] as const;

      const error = captureMissingResponseDefinitionError(() =>
        getResponseDefinition(responses, "notFoundError")
      );

      expect(error).toEqual(
        expect.objectContaining({
          responseName: "notFoundError",
        })
      );
    });

    test("reports the requested response when the response array is empty", () => {
      const responses = [] as readonly ResponseDefinition[];

      const error = captureMissingResponseDefinitionError(() =>
        getResponseDefinition(responses, "CreateTodoSuccess")
      );

      expect(error).toEqual(
        expect.objectContaining({
          responseName: "CreateTodoSuccess",
        })
      );
    });
  });
});
