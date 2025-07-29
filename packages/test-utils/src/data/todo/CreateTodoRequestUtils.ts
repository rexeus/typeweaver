import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";
import type {
  ICreateTodoRequest,
  ICreateTodoRequestBody,
  ICreateTodoRequestHeader,
} from "../..";

export const createCreateTodoRequestHeaders = createDataFactory<ICreateTodoRequestHeader>(() => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${createJwtToken()}`,
}));

export const createCreateTodoRequestBody = createDataFactory<ICreateTodoRequestBody>(() => ({
  title: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  dueDate: faker.date.future().toISOString(),
  tags: [faker.lorem.word(), faker.lorem.word()],
  priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"] as const),
}));

type CreateTodoRequestInput = {
  path?: string;
  body?: Partial<ICreateTodoRequestBody>;
  header?: Partial<ICreateTodoRequestHeader>;
};

export function createCreateTodoRequest(
  input: CreateTodoRequestInput = {}
): ICreateTodoRequest {
  return createRequest<ICreateTodoRequest, ICreateTodoRequestBody, ICreateTodoRequestHeader, never, never>(
    {
      method: HttpMethod.POST,
      path: "/todos",
    },
    {
      body: createCreateTodoRequestBody,
      header: createCreateTodoRequestHeaders,
    },
    input
  );
}
