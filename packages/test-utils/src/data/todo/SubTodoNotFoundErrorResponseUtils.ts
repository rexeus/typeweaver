import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ISubTodoNotFoundErrorResponse,
  ISubTodoNotFoundErrorResponseHeader,
  ISubTodoNotFoundErrorResponseBody,
} from "../..";
type SubTodoNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISubTodoNotFoundErrorResponseHeader>;
  body?: Partial<ISubTodoNotFoundErrorResponseBody>;
};

export function createSubTodoNotFoundErrorResponse(
  input: SubTodoNotFoundErrorResponseInput = {}
): ISubTodoNotFoundErrorResponse {
  const defaults: ISubTodoNotFoundErrorResponse = {
    statusCode: HttpStatusCode.NOT_FOUND,
    header: createErrorResponseHeaders<ISubTodoNotFoundErrorResponseHeader>(),
    body: {
      message: "SubTodo not found",
      code: "SUBTODO_NOT_FOUND_ERROR",
      context: {
        todoId: faker.string.ulid(),
      },
      actualValues: {
        subtodoId: faker.string.ulid(),
      },
    },
  };

  const overrides: Partial<ISubTodoNotFoundErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
