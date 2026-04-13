import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createRefreshTokenSuccessResponse as generatedCreateRefreshTokenSuccessResponse } from "../../test-project/output/responses/RefreshTokenSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createJwtToken } from "../createJwtToken.js";
import { createResponse } from "../createResponse.js";
import type {
  IRefreshTokenSuccessResponse,
  IRefreshTokenSuccessResponseBody,
  IRefreshTokenSuccessResponseHeader,
} from "../../index.js";

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
