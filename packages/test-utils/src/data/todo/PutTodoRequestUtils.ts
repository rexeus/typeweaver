import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IPutTodoRequest,
  IPutTodoRequestHeader,
  IPutTodoRequestParam,
  IPutTodoRequestBody,
} from "../..";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";

export function createPutTodoRequestHeaders(
  input: Partial<IPutTodoRequestHeader> = {}
): IPutTodoRequestHeader {
  const defaults: IPutTodoRequestHeader = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createPutTodoRequestParams(
  input: Partial<IPutTodoRequestParam> = {}
): IPutTodoRequestParam {
  const defaults: IPutTodoRequestParam = {
    todoId: faker.string.ulid(),
  };

  return createData(defaults, input);
}

export function createPutTodoRequestBody(
  input: Partial<IPutTodoRequestBody> = {}
): IPutTodoRequestBody {
  const defaults: IPutTodoRequestBody = {
    accountId: faker.string.ulid(),
    parentId: faker.string.ulid(),
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement([
      "TODO",
      "IN_PROGRESS",
      "DONE",
      "ARCHIVED",
    ] as const),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
  };

  return createData(defaults, input);
}

type PutTodoRequestInput = {
  path?: string;
  header?: Partial<IPutTodoRequestHeader>;
  param?: Partial<IPutTodoRequestParam>;
  body?: Partial<IPutTodoRequestBody>;
};

export function createPutTodoRequest(
  input: PutTodoRequestInput = {}
): IPutTodoRequest {
  const param = input.param
    ? createPutTodoRequestParams(input.param)
    : createPutTodoRequestParams();

  const defaults: IPutTodoRequest = {
    method: HttpMethod.PUT,
    path: `/todos/${param.todoId}`,
    header: createPutTodoRequestHeaders(),
    param,
    body: createPutTodoRequestBody(),
  };

  const overrides: Partial<IPutTodoRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createPutTodoRequestHeaders(input.header);
  if (input.param !== undefined)
    overrides.param = createPutTodoRequestParams(input.param);
  if (input.body !== undefined)
    overrides.body = createPutTodoRequestBody(input.body);

  return createData(defaults, overrides as IPutTodoRequest);
}
