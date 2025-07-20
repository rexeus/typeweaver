import { faker } from "@faker-js/faker";
import type { IGetTodoSuccessResponseBody } from "../../../test-project/output/todo/GetTodoResponse";
import { createData } from "./createData";

export function createTodo(
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
    ]),
    dueDate: faker.date.future().toISOString(),
    tags: [faker.lorem.word(), faker.lorem.word()],
    priority: faker.helpers.arrayElement(["LOW", "MEDIUM", "HIGH"]),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}
