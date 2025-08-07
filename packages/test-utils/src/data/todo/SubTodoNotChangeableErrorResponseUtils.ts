import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISubTodoNotChangeableErrorResponseBody,
  ISubTodoNotChangeableErrorResponseHeader,
  ISubTodoNotChangeableErrorResponse,
} from "../..";
import { SubTodoNotChangeableErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createSubTodoNotChangeableErrorResponseHeader =
  createDataFactory<ISubTodoNotChangeableErrorResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createSubTodoNotChangeableErrorResponseBody =
  createDataFactory<ISubTodoNotChangeableErrorResponseBody>(() => {
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

    return {
      message:
        "SubTodo in current status or because of parent todo status cannot be changed",
      code: "SUBTODO_NOT_CHANGEABLE_ERROR",
      context: {
        todoId: faker.string.ulid(),
        subtodoId: faker.string.ulid(),
        currentTodoStatus,
        currentSubtodoStatus,
      },
      expectedValues: {
        allowedTodoStatuses: faker.helpers.arrayElements(
          ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
          { min: 1, max: 4 }
        ) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
        allowedSubtodoStatuses: faker.helpers.arrayElements(
          ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
          { min: 1, max: 4 }
        ) as ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[],
      },
    };
  });

type SubTodoNotChangeableErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoNotChangeableErrorResponseHeader>;
  body?: Partial<ISubTodoNotChangeableErrorResponseBody>;
};

export function createSubTodoNotChangeableErrorResponse(
  input: SubTodoNotChangeableErrorResponseInput = {}
): SubTodoNotChangeableErrorResponse {
  const responseData = createResponse<
    ISubTodoNotChangeableErrorResponse,
    ISubTodoNotChangeableErrorResponseBody,
    ISubTodoNotChangeableErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createSubTodoNotChangeableErrorResponseBody,
      header: createSubTodoNotChangeableErrorResponseHeader,
    },
    input
  );
  return new SubTodoNotChangeableErrorResponse(responseData);
}
