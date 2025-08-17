import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IUpdateTodoStatusRequest,
  IUpdateTodoStatusRequestBody,
  IUpdateTodoStatusRequestHeader,
  IUpdateTodoStatusRequestParam,
} from "../..";

export const createUpdateTodoStatusRequestHeader =
  createDataFactory<IUpdateTodoStatusRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createUpdateTodoStatusRequestParam =
  createDataFactory<IUpdateTodoStatusRequestParam>(() => ({
    todoId: faker.string.ulid(),
  }));

export const createUpdateTodoStatusRequestBody =
  createDataFactory<IUpdateTodoStatusRequestBody>(() => ({
    value: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
  }));

type UpdateTodoStatusRequestInput = {
  path?: string;
  header?: Partial<IUpdateTodoStatusRequestHeader>;
  param?: Partial<IUpdateTodoStatusRequestParam>;
  body?: Partial<IUpdateTodoStatusRequestBody>;
};

export function createUpdateTodoStatusRequest(
  input: UpdateTodoStatusRequestInput = {}
): IUpdateTodoStatusRequest {
  // Generate param first for dynamic path building
  const param = input.param
    ? createUpdateTodoStatusRequestParam(input.param)
    : createUpdateTodoStatusRequestParam();

  // If path is not explicitly provided, build it dynamically
  const dynamicPath = input.path ?? `/todos/${param.todoId}/status`;

  return createRequest<
    IUpdateTodoStatusRequest,
    IUpdateTodoStatusRequestBody,
    IUpdateTodoStatusRequestHeader,
    IUpdateTodoStatusRequestParam,
    never
  >(
    {
      method: HttpMethod.PUT,
      path: dynamicPath,
    },
    {
      body: createUpdateTodoStatusRequestBody,
      header: createUpdateTodoStatusRequestHeader,
      param: () => param, // Use pre-generated param
    },
    input
  );
}
