import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import type {
  IRegisterAccountRequest,
  IRegisterAccountRequestBody,
  IRegisterAccountRequestHeader,
} from "../..";

export const createRegisterAccountRequestBody =
  createDataFactory<IRegisterAccountRequestBody>(() => ({
    email: faker.internet.email(),
    password: faker.internet.password(),
  }));

export const createRegisterAccountRequestHeader =
  createDataFactory<IRegisterAccountRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
  }));

type RegisterAccountRequestInput = {
  path?: string;
  body?: Partial<IRegisterAccountRequestBody>;
  header?: Partial<IRegisterAccountRequestHeader>;
};

export function createRegisterAccountRequest(
  input: RegisterAccountRequestInput = {}
): IRegisterAccountRequest {
  return createRequest<
    IRegisterAccountRequest,
    IRegisterAccountRequestBody,
    IRegisterAccountRequestHeader,
    never,
    never
  >(
    {
      method: HttpMethod.POST,
      path: "/accounts",
    },
    {
      body: createRegisterAccountRequestBody,
      header: createRegisterAccountRequestHeader,
    },
    input
  );
}
