import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IUnauthorizedErrorResponse,
  IUnauthorizedErrorResponseHeader,
  IUnauthorizedErrorResponseBody,
} from "../..";
import { UnauthorizedErrorResponse } from "../..";

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
): UnauthorizedErrorResponse {
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
      header: createErrorResponseHeaders<IUnauthorizedErrorResponseHeader>(),
    },
    input
  );
  return new UnauthorizedErrorResponse(responseData);
}
