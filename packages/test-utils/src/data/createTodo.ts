import { faker } from "@faker-js/faker";
import type { ICreateTodoRequestBody, IGetTodoSuccessResponseBody } from "..";
import { createData } from "./createData";

export function createTodoInput(
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

export function createTodoOutput(
  input: Partial<IGetTodoSuccessResponseBody> = {}
): IGetTodoSuccessResponseBody {
  const defaults: IGetTodoSuccessResponseBody = {
    id: faker.string.uuid(),
    accountId: faker.string.uuid(),
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
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}
