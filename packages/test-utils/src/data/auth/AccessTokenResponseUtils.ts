import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { AccessTokenSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createResponse } from "../createResponse";
import type {
  IAccessTokenSuccessResponse,
  IAccessTokenSuccessResponseBody,
  IAccessTokenSuccessResponseHeader,
} from "../..";

export const createAccessTokenSuccessResponseHeader =
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
      header: createAccessTokenSuccessResponseHeader,
    },
    input
  );
  return new AccessTokenSuccessResponse(responseData);
}
