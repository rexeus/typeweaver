import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createJwtToken } from "../createJwtToken";
import type {
  IAccessTokenSuccessResponseBody,
  IAccessTokenSuccessResponseHeader,
  IAccessTokenSuccessResponse,
} from "../..";
import { AccessTokenSuccessResponse } from "../..";

export const createAccessTokenSuccessResponseHeaders =
  createDataFactory<IAccessTokenSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createAccessTokenSuccessResponseBody =
  createDataFactory<IAccessTokenSuccessResponseBody>(() => ({
    accessToken: createJwtToken(),
    refreshToken: createJwtToken(),
  }));

type AccessTokenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IAccessTokenSuccessResponseHeader>;
  body?: Partial<IAccessTokenSuccessResponseBody>;
};

export function createAccessTokenSuccessResponse(
  input: AccessTokenSuccessResponseInput = {}
): AccessTokenSuccessResponse {
  const responseData = createResponse<
    IAccessTokenSuccessResponse,
    IAccessTokenSuccessResponseBody,
    IAccessTokenSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createAccessTokenSuccessResponseBody,
      header: createAccessTokenSuccessResponseHeaders,
    },
    input
  );
  return new AccessTokenSuccessResponse(responseData);
}
