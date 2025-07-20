import { faker } from "@faker-js/faker";
import type {
  IRegisterAccountRequestBody,
  IRegisterAccountSuccessResponseBody,
} from "..";
import { createData } from "./createData";

export function createAccountInput(
  input: Partial<IRegisterAccountRequestBody> = {}
): IRegisterAccountRequestBody {
  const defaults: IRegisterAccountRequestBody = {
    email: faker.internet.email(),
    password: faker.internet.password(),
  };

  return createData(defaults, input);
}

export function createAccountOutput(
  input: Partial<IRegisterAccountSuccessResponseBody> = {}
): IRegisterAccountSuccessResponseBody {
  const defaults: IRegisterAccountSuccessResponseBody = {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, input);
}
