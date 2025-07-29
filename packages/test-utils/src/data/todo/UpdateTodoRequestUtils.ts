import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IUpdateTodoRequest,
  IUpdateTodoRequestHeader,
  IUpdateTodoRequestParam,
  IUpdateTodoRequestBody,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createUpdateTodoRequestHeaders(
  input: Partial<IUpdateTodoRequestHeader> = {}
): IUpdateTodoRequestHeader {
  const defaults: IUpdateTodoRequestHeader = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createUpdateTodoRequestParams(
  input: Partial<IUpdateTodoRequestParam> = {}
): IUpdateTodoRequestParam {
  const defaults: IUpdateTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createUpdateTodoRequestBody(
  input: Partial<IUpdateTodoRequestBody> = {}
): IUpdateTodoRequestBody {
  const defaults: IUpdateTodoRequestBody = {
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
  };

  return createData(defaults, input);
}

type UpdateTodoRequestInput = {
  path?: string;
  header?: Partial<IUpdateTodoRequestHeader>;
  param?: Partial<IUpdateTodoRequestParam>;
  body?: Partial<IUpdateTodoRequestBody>;
};

export function createUpdateTodoRequest(
  input: UpdateTodoRequestInput = {}
): IUpdateTodoRequest {
  const param = input.param
    ? createUpdateTodoRequestParams(input.param)
    : createUpdateTodoRequestParams();

  const defaults: IUpdateTodoRequest = {
    method: HttpMethod.PATCH,
    path: `/todos/${param.todoId}`,
    header: createUpdateTodoRequestHeaders(),
    param,
    body: createUpdateTodoRequestBody(),
  };

  const overrides: Partial<IUpdateTodoRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createUpdateTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createUpdateTodoRequestParams(input.param);
  if (input.body !== undefined)
    overrides.body = createUpdateTodoRequestBody(input.body);

  return createData(defaults, overrides as IUpdateTodoRequest);
}
