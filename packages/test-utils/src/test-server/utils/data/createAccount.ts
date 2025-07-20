import { faker } from "@faker-js/faker";
import type { IRegisterAccountSuccessResponseBody } from "../../../test-project/output/account/RegisterAccountResponse";
import { createData } from "./createData";

export function createAccount(
  overrides?: Partial<IRegisterAccountSuccessResponseBody>
): IRegisterAccountSuccessResponseBody {
  const defaults: IRegisterAccountSuccessResponseBody = {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    createdAt: faker.date.past().toISOString(),
    modifiedAt: faker.date.recent().toISOString(),
    createdBy: faker.internet.username(),
    modifiedBy: faker.internet.username(),
  };

  return createData(defaults, overrides);
}
