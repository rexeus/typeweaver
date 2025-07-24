import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISubTodoStatusTransitionInvalidErrorResponseBody,
  ISubTodoStatusTransitionInvalidErrorResponseHeader,
  ISubTodoStatusTransitionInvalidErrorResponse,
} from "../..";
import { createData } from "../createData";

export function createSubTodoStatusTransitionInvalidErrorResponseHeaders(
  input: Partial<ISubTodoStatusTransitionInvalidErrorResponseHeader> = {}
): ISubTodoStatusTransitionInvalidErrorResponseHeader {
  const defaults: ISubTodoStatusTransitionInvalidErrorResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createSubTodoStatusTransitionInvalidErrorResponseBody(
  input: Partial<ISubTodoStatusTransitionInvalidErrorResponseBody> = {}
): ISubTodoStatusTransitionInvalidErrorResponseBody {
  const currentTodoStatus = faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  const currentSubtodoStatus = faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  const requestedSubtodoStatus = faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

  const defaults: ISubTodoStatusTransitionInvalidErrorResponseBody = {
    message: "SubTodo status transition is conflicting with its status or parent todo status",
    code: "SUBTODO_STATUS_TRANSITION_INVALID_ERROR",
    context: {
      todoId: faker.string.ulid(),
      subtodoId: faker.string.ulid(),
      currentTodoStatus,
      currentSubtodoStatus,
    },
    actualValues: {
      requestedSubtodoStatus,
    },
    expectedValues: {
      allowedSubtodoStatuses: faker.helpers.arrayElements(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"], { min: 1, max: 4 }) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
    },
  };

  return createData(defaults, input);
}

type SubTodoStatusTransitionInvalidErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoStatusTransitionInvalidErrorResponseHeader>;
  body?: Partial<ISubTodoStatusTransitionInvalidErrorResponseBody>;
};

export function createSubTodoStatusTransitionInvalidErrorResponse(
  input: SubTodoStatusTransitionInvalidErrorResponseInput = {}
): ISubTodoStatusTransitionInvalidErrorResponse {
  const defaults: ISubTodoStatusTransitionInvalidErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header: createSubTodoStatusTransitionInvalidErrorResponseHeaders(),
    body: createSubTodoStatusTransitionInvalidErrorResponseBody(),
  };

  const overrides: Partial<ISubTodoStatusTransitionInvalidErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createSubTodoStatusTransitionInvalidErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createSubTodoStatusTransitionInvalidErrorResponseBody(input.body);

  return createData(defaults, overrides);
}