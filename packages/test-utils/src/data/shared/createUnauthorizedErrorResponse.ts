import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { UnauthorizedErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IUnauthorizedErrorResponse,
  IUnauthorizedErrorResponseBody,
  IUnauthorizedErrorResponseHeader,
} from "../..";

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
      header: createErrorResponseHeader<IUnauthorizedErrorResponseHeader>(),
    },
    input
  );
  return new UnauthorizedErrorResponse(responseData);
}
