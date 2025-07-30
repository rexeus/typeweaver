import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createJwtToken } from "../createJwtToken";
import type {
  IRefreshTokenSuccessResponseBody,
  IRefreshTokenSuccessResponseHeader,
  IRefreshTokenSuccessResponse,
} from "../..";
import { RefreshTokenSuccessResponse } from "../..";

export const createRefreshTokenSuccessResponseHeaders =
  createDataFactory<IRefreshTokenSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createRefreshTokenSuccessResponseBody =
  createDataFactory<IRefreshTokenSuccessResponseBody>(() => ({
    accessToken: createJwtToken(),
    refreshToken: createJwtToken(),
  }));

type RefreshTokenSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IRefreshTokenSuccessResponseHeader>;
  body?: Partial<IRefreshTokenSuccessResponseBody>;
};

export function createRefreshTokenSuccessResponse(
  input: RefreshTokenSuccessResponseInput = {}
): RefreshTokenSuccessResponse {
  const responseData = createResponse<
    IRefreshTokenSuccessResponse,
    IRefreshTokenSuccessResponseBody,
    IRefreshTokenSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createRefreshTokenSuccessResponseBody,
      header: createRefreshTokenSuccessResponseHeaders,
    },
    input
  );
  return new RefreshTokenSuccessResponse(responseData);
}
