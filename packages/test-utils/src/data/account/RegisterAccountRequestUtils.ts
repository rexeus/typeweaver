import { HttpMethod } from "@rexeus/typeweaver-core";
import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IRegisterAccountRequestBody,
  IRegisterAccountRequestHeader,
} from "../..";
import { createData } from "../createData";

export function createRegisterAccountRequestBody(
  input: Partial<IRegisterAccountRequestBody> = {}
): IRegisterAccountRequestBody {
  const defaults: IRegisterAccountRequestBody = {
    email: faker.internet.email(),
    password: faker.internet.password(),
  };

  return createData(defaults, input);
}

export function createRegisterAccountRequestHeaders(
  input: Partial<IRegisterAccountRequestHeader> = {}
): IRegisterAccountRequestHeader {
  const defaults: IRegisterAccountRequestHeader = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  return createData(defaults, input);
}

type RegisterAccountRequestInput = {
  method?: HttpMethod;
  path?: string;
  body?: Partial<IRegisterAccountRequestBody>;
  header?: Partial<IRegisterAccountRequestHeader>;
};

export function createRegisterAccountRequest(
  input: RegisterAccountRequestInput = {}
): IHttpRequest {
  const defaults: IHttpRequest = {
    method: HttpMethod.POST,
    path: "/accounts",
    body: createRegisterAccountRequestBody(),
    header: createRegisterAccountRequestHeaders(),
  };

  const overrides: Partial<IHttpRequest> = {};
  if (input.method !== undefined) overrides.method = input.method;
  if (input.path !== undefined) overrides.path = input.path;
  if (input.body !== undefined) overrides.body = createRegisterAccountRequestBody(input.body);
  if (input.header !== undefined)
    overrides.header = createRegisterAccountRequestHeaders(input.header);

  return createData(defaults, overrides);
}