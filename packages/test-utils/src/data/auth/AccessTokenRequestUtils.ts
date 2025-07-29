import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  IAccessTokenRequest,
  IAccessTokenRequestBody,
  IAccessTokenRequestHeader,
} from "../..";
import { createData } from "../createData";

export function createAccessTokenRequestHeaders(
  input: Partial<IAccessTokenRequestHeader> = {}
): IAccessTokenRequestHeader {
  const defaults: IAccessTokenRequestHeader = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  return createData(defaults, input);
}

export function createAccessTokenRequestBody(
  input: Partial<IAccessTokenRequestBody> = {}
): IAccessTokenRequestBody {
  const defaults: IAccessTokenRequestBody = {
    email: faker.internet.email(),
    password: faker.internet.password(),
  };

  return createData(defaults, input);
}

type AccessTokenRequestInput = {
  path?: string;
  header?: Partial<IAccessTokenRequestHeader>;
  body?: Partial<IAccessTokenRequestBody>;
};

export function createAccessTokenRequest(
  input: AccessTokenRequestInput = {}
): IAccessTokenRequest {
  const defaults: IAccessTokenRequest = {
    method: HttpMethod.POST,
    path: "/auth/access-token",
    header: createAccessTokenRequestHeaders(),
    body: createAccessTokenRequestBody(),
  };

  const overrides: Partial<IAccessTokenRequest> = {};
  if (input.path !== undefined) overrides.path = input.path;
  if (input.header !== undefined)
    overrides.header = createAccessTokenRequestHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createAccessTokenRequestBody(input.body);

  return createData(defaults, overrides as IAccessTokenRequest);
}
