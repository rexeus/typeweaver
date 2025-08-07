import { HttpMethod } from "@rexeus/typeweaver-core";
import type {
  IRefreshTokenRequest,
  IRefreshTokenRequestBody,
  IRefreshTokenRequestHeader,
} from "../..";
import { createDataFactory } from "../createDataFactory";
import { createRequest } from "../createRequest";
import { createJwtToken } from "../createJwtToken";

export const createRefreshTokenRequestHeader =
  createDataFactory<IRefreshTokenRequestHeader>(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
  }));

export const createRefreshTokenRequestBody =
  createDataFactory<IRefreshTokenRequestBody>(() => ({
    refreshToken: createJwtToken(),
  }));

type RefreshTokenRequestInput = {
  path?: string;
  header?: Partial<IRefreshTokenRequestHeader>;
  body?: Partial<IRefreshTokenRequestBody>;
};

export function createRefreshTokenRequest(
  input: RefreshTokenRequestInput = {}
): IRefreshTokenRequest {
  return createRequest<
    IRefreshTokenRequest,
    IRefreshTokenRequestBody,
    IRefreshTokenRequestHeader,
    never,
    never
  >(
    {
      method: HttpMethod.POST,
      path: "/auth/refresh-token",
    },
    {
      body: createRefreshTokenRequestBody,
      header: createRefreshTokenRequestHeader,
    },
    input
  );
}
