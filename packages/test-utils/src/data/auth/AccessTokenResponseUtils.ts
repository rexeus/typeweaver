import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createAccessTokenSuccessResponse as generatedCreateAccessTokenSuccessResponse } from "../../test-project/output/responses/AccessTokenSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createJwtToken } from "../createJwtToken.js";
import { createResponse } from "../createResponse.js";
import type {
  IAccessTokenSuccessResponse,
  IAccessTokenSuccessResponseBody,
  IAccessTokenSuccessResponseHeader,
} from "../../index.js";

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
): IAccessTokenSuccessResponse {
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
  return generatedCreateAccessTokenSuccessResponse(responseData);
}
