import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createData } from "../createData";
import { createJwtToken } from "../createJwtToken";
import type {
  ICreateTodoRequest,
  ICreateTodoRequestBody,
  ICreateTodoRequestHeader,
} from "../..";

export function createCreateTodoRequestHeaders(
  input: Partial<ICreateTodoRequestHeader> = {}
): ICreateTodoRequestHeader {
  const defaults: ICreateTodoRequestHeader = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  };

  return createData(defaults, input);
}

export function createCreateTodoRequestBody(
  input: Partial<ICreateTodoRequestBody> = {}
): ICreateTodoRequestBody {
  const defaults: ICreateTodoRequestBody = {
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
  };

  return createData(defaults, input);
}

type CreateTodoRequestInput = {
  path?: string;
  body?: Partial<ICreateTodoRequestBody>;
  header?: Partial<ICreateTodoRequestHeader>;
};

export function createCreateTodoRequest(
  input: CreateTodoRequestInput = {}
): ICreateTodoRequest {
  const defaults: ICreateTodoRequest = {
    method: HttpMethod.POST,
    path: "/todos",
    body: createCreateTodoRequestBody(),
    header: createCreateTodoRequestHeaders(),
  };

  const overrides: Partial<ICreateTodoRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.body !== undefined)
    overrides.body = createCreateTodoRequestBody(input.body);
  if (input.header !== undefined)
    overrides.header = createCreateTodoRequestHeaders(input.header);

  return createData(defaults, overrides as ICreateTodoRequest);
}
