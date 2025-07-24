import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISubTodoNotChangeableErrorResponseBody,
  ISubTodoNotChangeableErrorResponseHeader,
  ISubTodoNotChangeableErrorResponse,
} from "../..";
import { createData } from "../createData";

export function createSubTodoNotChangeableErrorResponseHeaders(
  input: Partial<ISubTodoNotChangeableErrorResponseHeader> = {}
): ISubTodoNotChangeableErrorResponseHeader {
  const defaults: ISubTodoNotChangeableErrorResponseHeader = {
    "Content-Type": "application/json",
  };

  return createData(defaults, input);
}

export function createSubTodoNotChangeableErrorResponseBody(
  input: Partial<ISubTodoNotChangeableErrorResponseBody> = {}
): ISubTodoNotChangeableErrorResponseBody {
  const currentTodoStatus = faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  const currentSubtodoStatus = faker.helpers.arrayElement(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

  const defaults: ISubTodoNotChangeableErrorResponseBody = {
    message: "SubTodo in current status or because of parent todo status cannot be changed",
    code: "SUBTODO_NOT_CHANGEABLE_ERROR",
    context: {
      todoId: faker.string.ulid(),
      subtodoId: faker.string.ulid(),
      currentTodoStatus,
      currentSubtodoStatus,
    },
    expectedValues: {
      allowedTodoStatuses: faker.helpers.arrayElements(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"], { min: 1, max: 4 }) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
      allowedSubtodoStatuses: faker.helpers.arrayElements(["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"], { min: 1, max: 4 }) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
    },
  };

  return createData(defaults, input);
}

type SubTodoNotChangeableErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoNotChangeableErrorResponseHeader>;
  body?: Partial<ISubTodoNotChangeableErrorResponseBody>;
};

export function createSubTodoNotChangeableErrorResponse(
  input: SubTodoNotChangeableErrorResponseInput = {}
): ISubTodoNotChangeableErrorResponse {
  const defaults: ISubTodoNotChangeableErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header: createSubTodoNotChangeableErrorResponseHeaders(),
    body: createSubTodoNotChangeableErrorResponseBody(),
  };

  const overrides: Partial<ISubTodoNotChangeableErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createSubTodoNotChangeableErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createSubTodoNotChangeableErrorResponseBody(input.body);

  return createData(defaults, overrides);
}