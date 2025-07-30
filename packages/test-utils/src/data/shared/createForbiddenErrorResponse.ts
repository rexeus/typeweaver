import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IForbiddenErrorResponse,
  IForbiddenErrorResponseHeader,
  IForbiddenErrorResponseBody,
} from "../..";
import { ForbiddenErrorResponse } from "../..";

type ForbiddenErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IForbiddenErrorResponseHeader>;
  body?: Partial<IForbiddenErrorResponseBody>;
};

const createForbiddenErrorResponseBody =
  createDataFactory<IForbiddenErrorResponseBody>(() => ({
    message: "Forbidden request",
    code: "FORBIDDEN_ERROR",
  }));

export function createForbiddenErrorResponse(
  input: ForbiddenErrorResponseInput = {}
): ForbiddenErrorResponse {
  const responseData = createResponse<
    IForbiddenErrorResponse,
    IForbiddenErrorResponseBody,
    IForbiddenErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.FORBIDDEN,
    },
    {
      body: createForbiddenErrorResponseBody,
      header: createErrorResponseHeaders<IForbiddenErrorResponseHeader>(),
    },
    input
  );
  return new ForbiddenErrorResponse(responseData);
}
