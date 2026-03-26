import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createResponse } from "../createResponse";
import { createRefreshTokenSuccessResponse as generatedCreateRefreshTokenSuccessResponse } from "../../test-project/output/auth/RefreshTokenResponse";
import type {
  IRefreshTokenSuccessResponse,
  IRefreshTokenSuccessResponseBody,
  IRefreshTokenSuccessResponseHeader,
} from "../..";

export const createRefreshTokenSuccessResponseHeader =
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
): IRefreshTokenSuccessResponse {
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
      header: createRefreshTokenSuccessResponseHeader,
    },
    input
  );
  return generatedCreateRefreshTokenSuccessResponse(responseData);
}
