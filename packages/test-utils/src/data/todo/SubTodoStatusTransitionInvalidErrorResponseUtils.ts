import { faker } from "@faker-js/faker";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { SubTodoStatusTransitionInvalidErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  ISubTodoStatusTransitionInvalidErrorResponse,
  ISubTodoStatusTransitionInvalidErrorResponseBody,
  ISubTodoStatusTransitionInvalidErrorResponseHeader,
} from "../..";

export const createSubTodoStatusTransitionInvalidErrorResponseHeader =
  createDataFactory<ISubTodoStatusTransitionInvalidErrorResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createSubTodoStatusTransitionInvalidErrorResponseBody =
  createDataFactory<ISubTodoStatusTransitionInvalidErrorResponseBody>(() => {
    const currentTodoStatus = faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
    const currentSubtodoStatus = faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
    const requestedSubtodoStatus = faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const) as "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

    return {
      message:
        "SubTodo status transition is conflicting with its status or parent todo status",
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
        allowedSubtodoStatuses: faker.helpers.arrayElements(
          ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
          { min: 1, max: 4 }
        ) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
      },
    };
  });

type SubTodoStatusTransitionInvalidErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoStatusTransitionInvalidErrorResponseHeader>;
  body?: Partial<ISubTodoStatusTransitionInvalidErrorResponseBody>;
};

export function createSubTodoStatusTransitionInvalidErrorResponse(
  input: SubTodoStatusTransitionInvalidErrorResponseInput = {}
): SubTodoStatusTransitionInvalidErrorResponse {
  const responseData = createResponse<
    ISubTodoStatusTransitionInvalidErrorResponse,
    ISubTodoStatusTransitionInvalidErrorResponseBody,
    ISubTodoStatusTransitionInvalidErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createSubTodoStatusTransitionInvalidErrorResponseBody,
      header: createSubTodoStatusTransitionInvalidErrorResponseHeader,
    },
    input
  );
  return new SubTodoStatusTransitionInvalidErrorResponse(responseData);
}
