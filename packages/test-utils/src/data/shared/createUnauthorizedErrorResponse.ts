import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createUnauthorizedErrorResponse as generatedCreateUnauthorizedErrorResponse } from "../../test-project/output/responses/UnauthorizedErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IUnauthorizedErrorResponse,
  IUnauthorizedErrorResponseBody,
  IUnauthorizedErrorResponseHeader,
} from "../../index.js";

type UnauthorizedErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IUnauthorizedErrorResponseHeader>;
  body?: Partial<IUnauthorizedErrorResponseBody>;
};

const createUnauthorizedErrorResponseBody =
  createDataFactory<IUnauthorizedErrorResponseBody>(() => ({
    message: "Unauthorized request",
    code: "UNAUTHORIZED_ERROR",
  }));

export function createUnauthorizedErrorResponse(
  input: UnauthorizedErrorResponseInput = {}
): IUnauthorizedErrorResponse {
  const responseData = createResponse<
    IUnauthorizedErrorResponse,
    IUnauthorizedErrorResponseBody,
    IUnauthorizedErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.UNAUTHORIZED,
    },
    {
      body: createUnauthorizedErrorResponseBody,
      header: createErrorResponseHeader<IUnauthorizedErrorResponseHeader>(),
    },
    input
  );
  return generatedCreateUnauthorizedErrorResponse(responseData);
}
