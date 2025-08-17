import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import type {
  IAccessTokenRequest,
  IAccessTokenRequestBody,
  IAccessTokenRequestHeader,
} from "../..";

export const createAccessTokenRequestHeader =
  createDataFactory<IAccessTokenRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
  }));

export const createAccessTokenRequestBody =
  createDataFactory<IAccessTokenRequestBody>(() => ({
    email: faker.internet.email(),
    password: faker.internet.password(),
  }));

type AccessTokenRequestInput = {
  path?: string;
  header?: Partial<IAccessTokenRequestHeader>;
  body?: Partial<IAccessTokenRequestBody>;
};

export function createAccessTokenRequest(
  input: AccessTokenRequestInput = {}
): IAccessTokenRequest {
  return createRequest<
    IAccessTokenRequest,
    IAccessTokenRequestBody,
    IAccessTokenRequestHeader,
    never,
    never
  >(
    {
      method: HttpMethod.POST,
      path: "/auth/access-token",
    },
    {
      body: createAccessTokenRequestBody,
      header: createAccessTokenRequestHeader,
    },
    input
  );
}
